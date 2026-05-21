import axios from "axios";

export const fetchLeadSummary = async () => {
  try {
    const SERVICE_A_URL = process.env.SERVICE_A_URL;

    console.log("SERVICE_A_URL =", SERVICE_A_URL);

    const response = await axios.get(
      `${SERVICE_A_URL}/api/reports/lead-summary`
    );

    return response.data;
  } catch (error: any) {
    console.error("Error fetching lead summary:", error.message);
    throw new Error("Failed to fetch lead summary");
  }
};