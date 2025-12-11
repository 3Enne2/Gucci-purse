export const AWS_IOT_ENDPOINT = "ar2mu015k9cf7-ats.iot.ap-southeast-1.amazonaws.com"; // xxxxxx-ats.iot.ap-southeast-2.amazonaws.com
export const AWS_IOT_TOPIC = "iot/mobile/tracker";
export const AWS_IOT_PORT = 443; //use wss://
//export const AWS_IOT_PORT = 8883; //8883 only for TLS MQTT (Device SDK, hardware devices)
export const AWS_REGION= "ap-southeast-2";
//IAM credentials (SigV4 signing. (DO NOT HARDCODE INPRODUCTION))
//export const AWS_ACCESS_KEY_ID="";
//export const AWS_SECRET_ACCESS_KEY="";
//export const AWS_SESSION_TOKEN=""; //For temporary credentials

//Device ID(optional)
export const DEVICE_ID="DION";
// Cognito Identity Pool ID
export const COGNITO_IDENTITY_POOL_ID =
  "ap-southeast-2:ed632b05-92a1-4f2d-ade0-17c609a206ae";

