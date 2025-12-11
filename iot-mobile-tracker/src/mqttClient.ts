import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import mqtt, {MqttClient} from "mqtt";

import CryptoJS from "crypto-js";

import {  
    AWS_IOT_ENDPOINT,
    AWS_IOT_TOPIC,
    AWS_REGION,
    DEVICE_ID,
    COGNITO_IDENTITY_POOL_ID,
} from "./awsConfig";

//Temporary credentials from Cognito
async function getIdentityId(): Promise<string> {
  const resp = await fetch(
    `https://cognito-identity.${AWS_REGION}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityService.GetId",
      },
      body: JSON.stringify({
        IdentityPoolId: COGNITO_IDENTITY_POOL_ID,
      }),
    }
  );

  const json = await resp.json();
  return json.IdentityId;
}


interface CognitoCredentials {
  AccessKeyId: string;
  SecretKey: string;
  SessionToken: string;
  Expiration: string;
}

async function getCredentials(identityId: string): Promise<CognitoCredentials> {
  const resp = await fetch(
    `https://cognito-identity.${AWS_REGION}.amazonaws.com/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target":
          "AWSCognitoIdentityService.GetCredentialsForIdentity",
      },
      body: JSON.stringify({ IdentityId: identityId }),
    }
  );

  const json = await resp.json();
  return json.Credentials as CognitoCredentials;
}







// SigV4 signing
interface SigV4Params {
  host: string;
  region: string;
  accessKeyId: string;
  secretKey: string;
  sessionToken: string;
}

function hmac(key: any, str: string) {
  return CryptoJS.HmacSHA256(str, key);
}

function signUrl({
  host,
  region,
  accessKeyId,
  secretKey,
  sessionToken,
}: SigV4Params): string {
  const service = "iotdevicegateway";
  const algorithm = "AWS4-HMAC-SHA256";

  const time = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = time.substring(0, 8);
  const credentialScope = `${date}/${region}/${service}/aws4_request`;

  const qs = {
    "X-Amz-Algorithm": algorithm,
    "X-Amz-Credential": encodeURIComponent(
      `${accessKeyId}/${credentialScope}`
    ),
    "X-Amz-Date": time,
    "X-Amz-SignedHeaders": "host",
    "X-Amz-Security-Token": encodeURIComponent(sessionToken),
  };

  const canonicalQuery = Object.entries(qs)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [
    "GET",
    "/mqtt",
    canonicalQuery,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    algorithm,
    time,
    credentialScope,
    CryptoJS.SHA256(canonicalRequest).toString(),
  ].join("\n");

  const kDate = hmac(`AWS4${secretKey}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, "aws4_request");

  const signature = hmac(kSigning, stringToSign).toString();

  return `wss://${host}/mqtt?${canonicalQuery}&X-Amz-Signature=${signature}`;
}







//Build AWS IoT Websocket URL
async function getSignedUrl(): Promise<string> {
  const identityId = await getIdentityId();
  const creds = await getCredentials(identityId);

  return signUrl({
    host: AWS_IOT_ENDPOINT,
    region: AWS_REGION,
    accessKeyId: creds.AccessKeyId,
    secretKey: creds.SecretKey,
    sessionToken: creds.SessionToken,
  });
}









//MQTT Client
let client: MqttClient | null = null;

export async function connectMQTT(): Promise<MqttClient> {
  const signedUrl = await getSignedUrl();

  client = mqtt.connect(signedUrl, {
    clientId: DEVICE_ID,
    protocol: "wss",
    keepalive: 30,
    reconnectPeriod: 3000 as any,
  });

  client.on("connect", () => console.log("[MQTT] Connected ✔"));
  client.on("error", (e) => console.log("[MQTT] Error:", e));

  return client;
}


//Publish telemetry payload
export function publishTelemetry(data: any) {
  if (!client || !client.connected) return;
  client.publish(AWS_IOT_TOPIC, JSON.stringify(data), { qos: 1 });
}


