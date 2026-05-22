import axios from "axios";

export const serviceAClient = axios.create({
  baseURL: process.env.SERVICE_A_URL,
  timeout: 5000,
});
