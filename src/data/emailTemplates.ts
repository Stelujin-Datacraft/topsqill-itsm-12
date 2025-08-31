export const EMAIL_TEMPLATES = [
  {
    name: "Welcome Email",
    description: "Welcome new users to your platform",
    subject: "Welcome to {{company_name}}, {{user_name}}!",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px;">Welcome to {{company_name}}!</h1>
    </div>
    <div style="padding: 40px 20px;">
      <h2 style="color: #333; margin-top: 0;">Hello {{user_name}},</h2>
      <p style="color: #666; line-height: 1.6; font-size: 16px;">
        We're thrilled to have you join our community! Your account has been successfully created and you're now ready to explore all the amazing features we have to offer.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{login_url}}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Get Started</a>
      </div>
      <p style="color: #666; line-height: 1.6;">
        If you have any questions, feel free to reach out to our support team. We're here to help!
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
      <p>Best regards,<br>The {{company_name}} Team</p>
    </div>
  </div>
</body>
</html>`,
    textContent: `Welcome to {{company_name}}, {{user_name}}!

Hello {{user_name}},

We're thrilled to have you join our community! Your account has been successfully created and you're now ready to explore all the amazing features we have to offer.

Get started by visiting: {{login_url}}

If you have any questions, feel free to reach out to our support team. We're here to help!

Best regards,
The {{company_name}} Team`,
    templateVariables: ['user_name', 'company_name', 'login_url']
  },
  {
    name: "Password Reset",
    description: "Password reset instructions for users",
    subject: "Reset your {{company_name}} password",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #dc3545; color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Password Reset Request</h1>
    </div>
    <div style="padding: 40px 20px;">
      <h2 style="color: #333; margin-top: 0;">Hello {{user_name}},</h2>
      <p style="color: #666; line-height: 1.6; font-size: 16px;">
        We received a request to reset your password for your {{company_name}} account. If you didn't make this request, you can safely ignore this email.
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{reset_url}}" style="background-color: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="color: #666; line-height: 1.6; font-size: 14px;">
        This link will expire in {{expiry_time}} for security reasons.
      </p>
      <p style="color: #666; line-height: 1.6; font-size: 14px;">
        If the button doesn't work, copy and paste this link into your browser:<br>
        <span style="background-color: #f8f9fa; padding: 5px; border-radius: 3px; word-break: break-all;">{{reset_url}}</span>
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
      <p>If you need help, contact our support team.</p>
    </div>
  </div>
</body>
</html>`,
    textContent: `Password Reset Request

Hello {{user_name}},

We received a request to reset your password for your {{company_name}} account. If you didn't make this request, you can safely ignore this email.

To reset your password, click this link: {{reset_url}}

This link will expire in {{expiry_time}} for security reasons.

If you need help, contact our support team.`,
    templateVariables: ['user_name', 'company_name', 'reset_url', 'expiry_time']
  },
  {
    name: "Order Confirmation",
    description: "Confirm customer orders with details",
    subject: "Order Confirmation #{{order_number}} - {{company_name}}",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #28a745; color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Order Confirmed!</h1>
    </div>
    <div style="padding: 40px 20px;">
      <h2 style="color: #333; margin-top: 0;">Thank you, {{customer_name}}!</h2>
      <p style="color: #666; line-height: 1.6; font-size: 16px;">
        Your order has been confirmed and is being processed. Here are your order details:
      </p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">Order #{{order_number}}</h3>
        <p style="margin: 5px 0; color: #666;"><strong>Order Date:</strong> {{order_date}}</p>
        <p style="margin: 5px 0; color: #666;"><strong>Total Amount:</strong> {{total_amount}}</p>
        <p style="margin: 5px 0; color: #666;"><strong>Payment Method:</strong> {{payment_method}}</p>
      </div>
      <h3 style="color: #333;">Shipping Information</h3>
      <p style="color: #666; line-height: 1.6;">
        {{shipping_address}}
      </p>
      <p style="color: #666; line-height: 1.6;">
        <strong>Estimated Delivery:</strong> {{delivery_date}}
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{tracking_url}}" style="background-color: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Track Your Order</a>
      </div>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
      <p>Questions about your order? Contact us at {{support_email}}</p>
    </div>
  </div>
</body>
</html>`,
    textContent: `Order Confirmation #{{order_number}}

Thank you, {{customer_name}}!

Your order has been confirmed and is being processed. Here are your order details:

Order #{{order_number}}
Order Date: {{order_date}}
Total Amount: {{total_amount}}
Payment Method: {{payment_method}}

Shipping Information:
{{shipping_address}}

Estimated Delivery: {{delivery_date}}

Track your order: {{tracking_url}}

Questions about your order? Contact us at {{support_email}}`,
    templateVariables: ['customer_name', 'order_number', 'order_date', 'total_amount', 'payment_method', 'shipping_address', 'delivery_date', 'tracking_url', 'support_email']
  },
  {
    name: "Meeting Invitation",
    description: "Invite participants to meetings or events",
    subject: "Meeting Invitation: {{meeting_title}} - {{meeting_date}}",
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Meeting Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <div style="background-color: #007bff; color: white; padding: 30px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px;">Meeting Invitation</h1>
    </div>
    <div style="padding: 40px 20px;">
      <h2 style="color: #333; margin-top: 0;">You're Invited!</h2>
      <p style="color: #666; line-height: 1.6; font-size: 16px;">
        Hello {{attendee_name}}, you're invited to join our upcoming meeting.
      </p>
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #333;">{{meeting_title}}</h3>
        <p style="margin: 5px 0; color: #666;"><strong>Date:</strong> {{meeting_date}}</p>
        <p style="margin: 5px 0; color: #666;"><strong>Time:</strong> {{meeting_time}}</p>
        <p style="margin: 5px 0; color: #666;"><strong>Duration:</strong> {{duration}}</p>
        <p style="margin: 5px 0; color: #666;"><strong>Location:</strong> {{location}}</p>
      </div>
      <h3 style="color: #333;">Agenda</h3>
      <p style="color: #666; line-height: 1.6;">
        {{agenda}}
      </p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="{{join_url}}" style="background-color: #007bff; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-right: 10px;">Join Meeting</a>
        <a href="{{calendar_url}}" style="background-color: #6c757d; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Add to Calendar</a>
      </div>
      <p style="color: #666; line-height: 1.6; font-size: 14px;">
        <strong>Organizer:</strong> {{organizer_name}} ({{organizer_email}})
      </p>
    </div>
    <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px;">
      <p>Can't attend? Please let us know by replying to this email.</p>
    </div>
  </div>
</body>
</html>`,
    textContent: `Meeting Invitation: {{meeting_title}}

Hello {{attendee_name}}, you're invited to join our upcoming meeting.

Meeting Details:
Title: {{meeting_title}}
Date: {{meeting_date}}
Time: {{meeting_time}}
Duration: {{duration}}
Location: {{location}}

Agenda:
{{agenda}}

Join the meeting: {{join_url}}
Add to calendar: {{calendar_url}}

Organizer: {{organizer_name}} ({{organizer_email}})

Can't attend? Please let us know by replying to this email.`,
    templateVariables: ['attendee_name', 'meeting_title', 'meeting_date', 'meeting_time', 'duration', 'location', 'agenda', 'join_url', 'calendar_url', 'organizer_name', 'organizer_email']
  }
];