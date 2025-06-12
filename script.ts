import crypto from "crypto";
import fs from "fs/promises";
import runLoginScript from "./cookies.js";
import dotenv from "dotenv";

dotenv.config();

const cookie = await runLoginScript();
const cookieString = cookie;
const usersFile = "./users.json";

// Get fresh token each time
const getToken = async (): Promise<{
  token: string;
  apiuser: string;
  userId: string;
  openId: string;
  operateId: string;
}> => {
  if (!cookieString) {
    throw new Error("Cookie string is null or undefined");
  }

  const response = await fetch("https://challenge.sunvoy.com/settings/tokens", {
    method: "GET",
    headers: {
      cookie: cookieString,
      referer: "https://challenge.sunvoy.com/settings",
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log("errot :",errorText);
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const responseText = await response.text();
  const regex_patterns = [
    /access_token["']?\s*:\s*["']([^"']+)["']/i,
    /token["']?\s*:\s*["']([^"']+)["']/i,
    /"access_token"\s*:\s*"([^"]+)"/i,
    /"token"\s*:\s*"([^"]+)"/i,
    /access_token=([^&\s"']+)/i,
    /token=([^&\s"']+)/i,
    /data-token=["']([^"']+)["']/i,
    /id="access_token"[^>]*value=["']([^"']+)["']/i,
    /id="token"[^>]*value=["']([^"']+)["']/i,
    /name="access_token"[^>]*value=["']([^"']+)["']/i,
    /name="token"[^>]*value=["']([^"']+)["']/i,
  ];

  for (const pattern of regex_patterns) {
    const match = responseText.match(pattern);
    if (match && match[1]) {
      const token = match[1];
      const apiuser = process.env.API_USER!;
      const userId = process.env.USER_ID!;
      const openId = process.env.OPEN_ID!;
      const operateId = process.env.OPERATE_ID!;

      return {
        token,
        apiuser,
        userId,
        openId,
        operateId,
      };
    }
  }

  console.log(responseText.substring(0, 2000));
  throw new Error("No tokens found");
};

//helps to get the user list
const getUser = async (): Promise<any[]> => {
  if (!cookieString) {
    throw new Error("Cookie string is required");
  }
  const response = await fetch("https://challenge.sunvoy.com/api/users", {
    method: "POST",
    headers: {
      cookie: cookieString,
      referer: "https://challenge.sunvoy.com/list",
      "content-type": "application/json",
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log("error :", errorText);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const responseText = await response.text();
  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
  }
};

// Generate checkcode  require to hit setting api
const generateCheckcode = (payload: Record<string, string>) => {
  const sorted = Object.keys(payload)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(payload[key])}`)
    .join("&");

  const hmac = crypto
    .createHmac("sha1", "mys3cr3t")
    .update(sorted)
    .digest("hex")
    .toUpperCase();
  return { sorted, hmac };
};

// Fetch the currently authenticated user's data
const fetchAuthenticatedUser = async (
  access_token: string,
  apiuser: string,
  userId: string,
  openId: string,
  operateId: string
): Promise<any> => {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const payload: Record<string, string> = {
    access_token,
    apiuser,
    language: "en_US",
    openId: openId,
    operateId: operateId,
    timestamp,
    userId,
  };

  const { sorted, hmac } = generateCheckcode(payload);
  const body = `${sorted}&checkcode=${hmac}`;

  const response = await fetch(
    "https://api.challenge.sunvoy.com/api/settings",
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        referer: "https://challenge.sunvoy.com/",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      },
      body: body,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.log("error :", errorText);
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const responseText = await response.text();

  try {
    return JSON.parse(responseText);
  } catch (jsonError) {
    throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
  }
};

// Save everything into users.json
const saveToJson = async (
  users: any[],
  authenticatedUser: any
): Promise<void> => {
  // which has both user and authentication result
  const combined = [...users, { authenticatedUser }];
  await fs.writeFile(usersFile, JSON.stringify(combined, null, 2), "utf8");
  console.log("user added is added to json file ....")
};

// Entry point
const main = async (): Promise<void> => {
  try {
    const users = await getUser();
    const { token, apiuser, userId, openId, operateId } = await getToken();
    const authenticatedUser = await fetchAuthenticatedUser(
      token,
      apiuser,
      userId,
      openId,
      operateId
    );
    await saveToJson(users, authenticatedUser);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
};

main();
