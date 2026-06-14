import emailjs from '@emailjs/browser';
import { log } from './logService';

export const sendHouseholdInvitationEmail = async (params: {
  to_email: string;
  inviter_name: string;
  household_name: string;
  invite_link?: string;
  app_url?: string;
}): Promise<boolean> => {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey || serviceId === 'your_service_id' || templateId === 'your_template_id' || publicKey === 'your_public_key') {
    log.warn(
      'EmailJS credentials are not configured in your environment. ' +
      'Please check your .env.local file.',
      {},
      'EmailService'
    );
    return false;
  }

  try {
    const emailParams = {
      to_email: params.to_email,
      inviter_name: params.inviter_name,
      household_name: params.household_name,
      invite_link: params.invite_link || window.location.origin,
      app_url: params.app_url || window.location.origin,
    };

    const response = await emailjs.send(serviceId, templateId, emailParams, publicKey);
    log.info('Invitation email sent successfully via EmailJS', { status: response.status }, 'EmailService');
    return true;
  } catch (err: any) {
    log.error('Failed to send email via EmailJS', err, 'EmailService');
    return false;
  }
};
