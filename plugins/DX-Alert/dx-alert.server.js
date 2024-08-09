////////////////////////////////////////////////////////////////
///                                                          ///
///  DX ALERT SERVER SCRIPT FOR FM-DX-WEBSERVER (V2.0)       ///
///                                                          ///
///  by Highpoint                last update: 08.08.24       ///
///                                                          ///
///  https://github.com/Highpoint2000/DX-Alert               ///
///                                                          ///
////////////////////////////////////////////////////////////////

///  This plugin only works from web server version 1.2.6!!!

// Configuration Variables
const EmailAddress = ''; // Alternative email address for DX alerts
const NewEmailFrequency = 60; // Frequency for new alerts in minutes, minimum 5 minutes
const AlertDistance = 200; // Distance for DX alarms in km, minimum 150 km
const Autostart = 'on'; // Start the alert on server startup ('on' or 'off')

////////////////////////////////////////////////////////////////

const WebSocket = require('ws');
const { logInfo, logError } = require('./../../server/console');
const config = require('./../../config.json');

// WebSocket and Server Configuration
const checkInterval = 1000; // Check interval in milliseconds
const clientIp = '127.0.0.1'; // Client IP address
const ServerName = config.identification.tunerName; 
const webserverPort = config.webserver.webserverPort || 8080; // Default to port 8080 if not specified
const externalWsUrl = `ws://127.0.0.1:${webserverPort}/extra`;

// Internal Variables
let currentStatus = Autostart; // Current status of the alert system
let lastStatus = Autostart; // Last known status
let lastAlertTime = Date.now(); // Last alert time
let lastAlertMessage = ""; // Last alert message
let TextSocket; // WebSocket connection for text alerts
const sentMessages = new Set(); // Track sent messages to avoid duplicates

// Validate email format using regex
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Get a valid email address from config or use provided email
function getValidEmail() {
    // Check if the provided EmailAddress is valid
    if (validateEmail(EmailAddress)) {
        return EmailAddress;
    }
    
    // If EmailAddress is invalid or empty, check config.identification.contact
    if (!EmailAddress && validateEmail(config.identification.contact)) {
        return config.identification.contact;
    }
    
    // If neither is valid, return an empty string
    return '';
}

const ValidEmailAddress = getValidEmail();

// If the email is invalid, stop further execution
if (ValidEmailAddress === '') {
    logError("DX-Alert: No valid email address found. DX ALERT not started.");
    process.exit(1); // Exit the script with a failure code
}

// Create a status message object
function createMessage(status, source) {
    return {
        type: 'DX-Alert',
        value: {
            status: status,
            email: ValidEmailAddress,
            freq: NewEmailFrequency,
            dist: AlertDistance
        },
        source: clientIp,
		target: source
    };
}

// Setup the TextSocket WebSocket connection
async function setupTextSocket() {
    if (!TextSocket || TextSocket.readyState === WebSocket.CLOSED) {
        try {
            TextSocket = new WebSocket('ws://highpoint2000.selfhost.de:9080/text');

            TextSocket.addEventListener("open", () => {
                logInfo("DX-Alert Text Websocket connected.");
            });

            TextSocket.addEventListener("message", handleTextSocketMessage);

            TextSocket.addEventListener("error", (error) => {
                logError("TextSocket error:", error);
            });

            TextSocket.addEventListener("close", (event) => {
                logInfo("TextSocket closed:", event);
                setTimeout(setupTextSocket, 5000); // Retry connection after 5 seconds
            });

        } catch (error) {
            logError("Failed to setup TextSocket:", error);
            setTimeout(setupTextSocket, 5000); // Retry connection after 5 seconds
        }
    }
}

// Handle incoming WebSocket messages
let processingAlert = false;

function handleTextSocketMessage(event) {
    try {
        const eventData = JSON.parse(event.data);
        const { freq: frequency, pi: picode, txInfo } = eventData;
        const { tx: station, city, itu, dist: distance } = txInfo || {};

        // If the alert system is off, reset alert status and return
        if (currentStatus === 'off') {
            resetAlertStatus();
            return;
        }

        // Process alert if conditions are met
        if (currentStatus === 'on' && distance > AlertDistance && AlertDistance > 149) {
            if (processingAlert) return;

            const now = Date.now();
            const elapsedMinutes = Math.floor((now - lastAlertTime) / 60000);
            const message = `${frequency}, ${picode}, ${station}, ${city} [${itu}], ${distance} km`;

            if (shouldSendAlert(elapsedMinutes, message)) {
                processingAlert = true;
                const subject = `DX ALERT over ${AlertDistance} km !!!`;
                sendEmail(subject, message);
                logInfo(subject, message);			            
                lastAlertTime = now;
                lastAlertMessage = message;

                setTimeout(() => processingAlert = false, 1000); // Reset processing flag after delay
            }
        } 
    } catch (error) {
        logError("DX-Alert: Error handling TextSocket message:", error);
    }
}

// Determine if a new alert should be sent
function shouldSendAlert(elapsedMinutes, message) {
    return (elapsedMinutes === 0 || elapsedMinutes > NewEmailFrequency) && 
           message !== lastAlertMessage && 
           NewEmailFrequency > 4;
}

// Reset alert status when the system is turned off
function resetAlertStatus() {
    lastAlertTime = 0;
    lastAlertMessage = "";
    processingAlert = false;
}

// Function to send email using EmailJS
function sendEmail(subject, message, source) {    
    const formData = {
        service_id: 'service_xz2llv8',
        template_id: 'template_1yir5nq',
        user_id: '8UurLFsfxfeCVmTjB',
        accessToken: '0fjKr71SLMk4XgvZN2kRX',
        template_params: {
            'from_name': ServerName,
            'to_email': ValidEmailAddress,
            'subject': subject,
            'message': message,
        }
    };

    fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
    })
    .then(response => {
        if (response.ok) {
            handleEmailResponse(subject, message, source);
        } else {
            return response.text().then(errorText => {
				sendWebSocketNotification('error', subject, message, source);
                throw new Error('Failed to send email. Error: ' + errorText);
            });
        }
    })
    .catch(error => logError(error.message));
}

// Handle email response
function handleEmailResponse(subject, message, source) {
    if (subject === 'DX ALERT Test Email') {
        logInfo(`DX-Alert responding with test email success`);
        sendWebSocketNotification('success', subject, message, source);
    } else {
        logInfo(`DX-Alert email sent to ${ValidEmailAddress}`);
        sendWebSocketNotification('sent', subject, message, source);
    }
}

// Send a WebSocket notification
function sendWebSocketNotification(status, subject, message, source) {
    if (extraWs && extraWs.readyState === WebSocket.OPEN) {
        const notification = {
            type: 'DX-Alert',
            value: {
                status: status,
                email: ValidEmailAddress || 'test@example.com',
                subject: subject,
                message: message,
            },
            source: clientIp,
            target: source
        };
        try {
            extraWs.send(JSON.stringify(notification));
        } catch (error) {
            logError("DX-Alert: Error sending WebSocket notification:", error);
        }
    } else {
        logError("DX-Alert: Extra WebSocket is not open or not defined.");
    }
}

// Connect to the main WebSocket server
function connectToWebSocket() {
    if (!ValidEmailAddress.includes('@')) {
        logError("Email Address not set or invalid format! DX ALERT not started.");
        return;
    }

    const ws = new WebSocket(externalWsUrl);

    ws.on('open', () => {
        // logInfo(`DX-Alert connected to ${ws.url}`);
        ws.send(JSON.stringify(createMessage(currentStatus, '255.255.255.255'))); // Send initial status
        // Delay the logging of broadcast info by 100 ms
        setTimeout(() => {
            logBroadcastInfo();
        }, 100);

    });

    ws.on('message', (data) => handleWebSocketMessage(data, ws));

    ws.on('error', (error) => logError('DX-Alert: WebSocket error:', error));

    ws.on('close', (code, reason) => {
        logInfo(`WebSocket connection closed. Code: ${code}, Reason: ${reason}`);
        setTimeout(connectToWebSocket, Math.min(5000 * 2 ** sentMessages.size, 30000)); // Exponential backoff
    });

    // Setup extra WebSocket connection for additional features
    setupExtraWebSocket();
}

// Log broadcast information based on current status
function logBroadcastInfo() {
    if (currentStatus === 'on') {
        logInfo(`DX-Alert broadcast "${currentStatus}" (Email: ${ValidEmailAddress} / Distance: ${AlertDistance} km / Frequency: ${NewEmailFrequency} min.)`);
    } else {
        logInfo(`DX-Alert broadcast "${currentStatus}"`);
    }
}

// Handle incoming WebSocket messages
function handleWebSocketMessage(data, ws) {
    try {
        const message = JSON.parse(data.toString());

        if (message.source === clientIp) return; // Ignore messages from self

        if (message.type === 'DX-Alert') {
            handleDXAlertMessage(message, ws);
        }
    } catch (error) {
        logError('DX-Alert: Error processing WebSocket message:', error);
    }
}

// Handle DX-Alert specific WebSocket messages
function handleDXAlertMessage(message, ws) {
    const { status } = message.value;

    if (status === 'request') {
        ws.send(JSON.stringify(createMessage(currentStatus, message.source)));
    } else if (status === 'test') {
        logInfo(`${message.type} received "${status}" from ${message.source}`);
        sendEmail(message.value.subject, message.value.message, message.source);          
    } else if (status === 'on' || status === 'off') {
        logInfo(`${message.type} received "${status}" from ${message.source}`);
        currentStatus = status;
        ws.send(JSON.stringify(createMessage(currentStatus, '255.255.255.255')));
		logInfo(`${message.type} responding with "${status}"`);
    }
}

// Set up a separate connection for the /extra WebSocket endpoint
function setupExtraWebSocket() {
    extraWs = new WebSocket(`ws://127.0.0.1:${webserverPort}/extra`);

    extraWs.on('open', () => {
        logInfo("DX-Alert Extra WebSocket connected.");
    });

    extraWs.on('error', (error) => logError("DX-Alert: Extra WebSocket error:", error));

    extraWs.on('close', (event) => {
        logInfo("Extra WebSocket closed:", event);
        setTimeout(setupExtraWebSocket, 5000); // Retry connection after 5 seconds
    });
}

// Initialize connections after a delay
setTimeout(setupTextSocket, 1000);
setTimeout(connectToWebSocket, 1000);
