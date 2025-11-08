// Approval Email Template
export const approvalEmailTemplate = (userName, uniqueId, loginUrl) => {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #22c55e;"> Welcome to Our Platform, ${userName}!</h2>
        
        <p>Your account has been successfully approved by our admin team.</p>
        
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #334155;">Your Login Credentials:</h3>
            <p><strong>Unique ID:</strong> <code style="background: #e2e8f0; padding: 5px 10px; border-radius: 4px;">${uniqueId}</code></p>
            <p><strong>Password:</strong> Same as you registered with</p>
        </div>

        <div style="margin: 25px 0;">
            <a href="${loginUrl}" 
               style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Login to Your Account
            </a>
        </div>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 14px;">
                <strong>Note:</strong> Use this Unique ID to login to your account. 
                Keep it secure and don't share with anyone.
            </p>
        </div>
    </div>
    `;
};
