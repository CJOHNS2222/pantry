import { defineJsonSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";

// Define the secret for Gmail configuration
const gmailConfigSecret = defineJsonSecret("EMAILSECRET");

let transporter: any;
let cachedGmailEmail: string | null = null;

const getTransporter = async () => {
  if (!transporter) {
    // Get the Gmail config from the secret
    const gmailConfig = gmailConfigSecret.value();
    if (!gmailConfig?.useremail || !gmailConfig?.clientid || !gmailConfig?.clientsecret || !gmailConfig?.refreshtoken) {
      throw new Error("Gmail OAuth2 credentials not configured in EMAILSECRET");
    }
    cachedGmailEmail = gmailConfig.useremail;
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: gmailConfig.useremail,
        clientId: gmailConfig.clientid,
        clientSecret: gmailConfig.clientsecret,
        refreshToken: gmailConfig.refreshtoken,
      },
    });
  }
  return transporter;
};

export const sendEmail = async (
  email: string,
  subject: string,
  body: string
) => {
  const transporter = await getTransporter();
  if (!cachedGmailEmail) {
    const gmailConfig = gmailConfigSecret.value();
    cachedGmailEmail = gmailConfig?.useremail || "noreply@smartpantry.com";
  }
  const mailOptions = {
    from: cachedGmailEmail,
    to: email,
    subject: subject,
    html: body,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log("Email sent to", email);
  } catch (err: any) {
    console.error("Error sending email:", error);
  }
};
