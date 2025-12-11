/*
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text>Open up App.tsx to start working on your app!</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
*/



import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

import React,{ useEffect, useState, useRef } from "react";
import {View, Text, ScrollView, Button, StyleSheet, Dimensions} from "react-native";
import MapView, {Marker} from "react-native-maps";
import * as Location from "expo-location";
import { Accelerometer, AccelerometerMeasurement } from "expo-sensors";
import * as Battery from "expo-battery";
import { connectMQTT, publishTelemetry } from "./src/mqttClient";
import {AWS_IOT_TOPIC} from "./src/awsConfig";


interface LogEntry {
  type: "sent" | "received";
  message: string;
  timestamp: string;
}


// log

export default function App(){
  //State & refs
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [accelerometerData, setAccelerometerData] = useState<AccelerometerMeasurement | null>(null);
  const [temperature, setTemperature] = useState<number | null>(null);
  const [clientConnected, setClientConnected] = useState<"connected"|"disconnected"|"reconnecting">("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const mqttClientRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const accelSubscriptionRef = useRef<any>(null);


  //Log function
    const addLog = (type: "sent" | "received", message: string) => {
    setLogs((prev: LogEntry[]) => [
      { type, message, timestamp: new Date().toLocaleTimeString() },
      ...prev,
    ]);
  };
  //Sending Telemetry
    const sendTelemetry = () => {
    const payload = {
      location: location
        ? { lat: location.latitude, lon: location.longitude, accuracy: location.accuracy }
        : undefined,
      accelerometer: accelerometerData
        ? { x: accelerometerData.x, y: accelerometerData.y, z: accelerometerData.z }
        : undefined,
      temperature: temperature ?? undefined,
    };

    publishTelemetry(payload);
    addLog("sent", JSON.stringify(payload));
  };


  //MQTT Setup
    const setupMQTT = async () => {
    try {
      const client = await connectMQTT();
      mqttClientRef.current = client;

      client.on("connect", () => {
        setClientConnected("connected");
        addLog("received", "[MQTT] Connected ✔");
      });

      client.on("close", () => {
        setClientConnected("disconnected");
        addLog("received", "[MQTT] Connection closed ❌");
      });

      client.on("reconnect", () => {
        setClientConnected("reconnecting");
        addLog("received", "[MQTT] Reconnecting ⚠️");
      });

      client.on("error", (err) => addLog("received", `[MQTT] Error: ${JSON.stringify(err)}`));

      client.on("message", (topic, message) => {
        if (topic === AWS_IOT_TOPIC) {
          addLog("received", message.toString());
        }
      });

      client.subscribe(AWS_IOT_TOPIC);
    } catch (error) {
      addLog("received", `[MQTT] Connection setup failed: ${error}`);
    }
  };











  //Main setup effect
  useEffect(() => {
    setupMQTT();

    // Location
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, distanceInterval: 1 },
          (loc: Location.LocationObject) => setLocation(loc.coords)
        );
      }
    })();

    // Accelerometer
    Accelerometer.setUpdateInterval(1000);
    accelSubscriptionRef.current = Accelerometer.addListener((data: AccelerometerMeasurement) => {
      setAccelerometerData(data);
    });

    // Battery
    (async () => {
      const batteryInfo = await Battery.getBatteryLevelAsync();
      setTemperature(batteryInfo ? batteryInfo * 50 : null);
    })();

    // Auto-send telemetry
    intervalRef.current = setInterval(() => sendTelemetry(), 10000);

    return () => {
      intervalRef.current && clearInterval(intervalRef.current);
      accelSubscriptionRef.current && accelSubscriptionRef.current.remove();
      mqttClientRef.current && mqttClientRef.current.end();
    };
  }, []);



  //Manual reconnect
  const handleReconnect = async () => {
    mqttClientRef.current && mqttClientRef.current.end(true);
    setClientConnected("reconnecting");
    addLog("received", "[MQTT] Manual reconnect triggered...");
    await setupMQTT();
  };




  // Render UI
  return (
    <View style={styles.container}>
      <Text style={[styles.status,
        clientConnected === "connected"
          ? styles.connected
          : clientConnected === "disconnected"
          ? styles.disconnected
          : styles.reconnecting
      ]}>
        MQTT Status: {clientConnected === "connected" ? "Connected ✅" : clientConnected === "disconnected" ? "Disconnected ❌" : "Reconnecting ⚠️"}
      </Text>

      <Button title="Send Telemetry Now" onPress={sendTelemetry} />
      <Button title="Reconnect MQTT" onPress={handleReconnect} />

      {location && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: location.latitude,
            longitude: location.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation
          followsUserLocation
        >
          <Marker
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Device"
            description={`Accuracy: ${location.accuracy}m`}
          />
        </MapView>
      )}

      <ScrollView style={styles.logContainer}>
        {logs.map((log, idx) => (
          <Text key={idx} style={log.type === "sent" ? styles.sent : styles.received}>
            [{log.timestamp}] {log.type.toUpperCase()}: {log.message}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}





//styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#fff" },
  status: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  connected: { color: "green" },
  disconnected: { color: "red" },
  reconnecting: { color: "orange" },
  map: { width: "100%", height: 250, marginVertical: 10 },
  logContainer: { marginTop: 10, flex: 1, borderWidth: 1, borderColor: "#ccc", padding: 5 },
  sent: { color: "green", marginVertical: 2 },
  received: { color: "blue", marginVertical: 2 },
});
