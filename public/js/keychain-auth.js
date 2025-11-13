/**
 * 3Speak Upload Demo - Hive Keychain Authentication
 * 
 * Handles Hive Keychain integration for user authentication.
 * Reference implementation showing proper Keychain usage.
 */

class KeychainAuth {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        this.keychainAvailable = false;
    }

    /**
     * Initialize Keychain authentication
     */
    init() {
        this.checkKeychainAvailability();
        return this;
    }

    /**
     * Check if Hive Keychain extension is available
     */
    checkKeychainAvailability() {
        const statusDiv = document.getElementById('keychain-status');
        
        // Check immediately
        this.updateKeychainStatus(statusDiv);
        
        // Check again after delay (Keychain may load asynchronously)
        setTimeout(() => {
            this.updateKeychainStatus(statusDiv);
        }, 1000);
    }

    /**
     * Update Keychain availability status in UI
     */
    updateKeychainStatus(statusDiv) {
        if (typeof window.hive_keychain !== 'undefined' && window.hive_keychain) {
            this.keychainAvailable = true;
            statusDiv.innerHTML = '<div class="status-message success">✅ Hive Keychain detected! Ready to login.</div>';
            
            // Perform handshake with Keychain
            try {
                window.hive_keychain.requestHandshake(() => {
                    console.log('Keychain handshake successful');
                });
            } catch (e) {
                console.warn('Keychain handshake error:', e);
            }
        } else {
            this.keychainAvailable = false;
            statusDiv.innerHTML = `
                <div class="status-message warning">
                    ⚠️ Hive Keychain not detected. 
                    <br>Please install Hive Keychain extension or use Keychain browser.
                    <br><a href="https://hive-keychain.com" target="_blank" style="color: #856404; font-weight: 600;">Get Hive Keychain →</a>
                </div>
            `;
        }
    }

    /**
     * Validate Hive username format
     */
    validateUsername(username) {
        const regex = /^[a-z0-9\-]{3,16}$/;
        return regex.test(username);
    }

    /**
     * Login with Hive Keychain
     * Uses requestSignBuffer to verify user owns the account
     */
    async login(username) {
        return new Promise((resolve, reject) => {
            const statusDiv = document.getElementById('keychain-status');
            
            // Validate username format
            if (!this.validateUsername(username)) {
                reject(new Error('Invalid username format. Use lowercase letters, numbers, and hyphens (3-16 characters).'));
                return;
            }

            // Check Keychain availability
            if (!this.keychainAvailable || !window.hive_keychain) {
                reject(new Error('Hive Keychain not available. Please install the extension.'));
                return;
            }

            // Show loading status
            statusDiv.innerHTML = '<div class="status-message info">🔐 Requesting Keychain authentication...</div>';

            // Create login message with timestamp to prevent replay attacks
            const loginMessage = `Login to 3Speak Upload Demo at ${Date.now()}`;
            
            // Request signature from Keychain (proves ownership)
            window.hive_keychain.requestSignBuffer(
                username,
                loginMessage,
                'Posting',
                (response) => {
                    if (response.success) {
                        // Authentication successful
                        this.currentUser = username;
                        this.isAuthenticated = true;
                        
                        statusDiv.innerHTML = '<div class="status-message success">✅ Successfully authenticated with Keychain!</div>';
                        
                        console.log('Login successful:', username);
                        resolve({
                            username: username,
                            signature: response.result,
                            message: loginMessage
                        });
                    } else {
                        // Authentication failed
                        const errorMsg = response.message || 'Authentication cancelled or failed';
                        statusDiv.innerHTML = `<div class="status-message error">❌ ${errorMsg}</div>`;
                        
                        console.error('Login failed:', response);
                        reject(new Error(errorMsg));
                    }
                }
            );
        });
    }

    /**
     * Logout current user
     */
    logout() {
        this.currentUser = null;
        this.isAuthenticated = false;
        console.log('User logged out');
    }

    /**
     * Get current authenticated user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user is authenticated
     */
    isUserAuthenticated() {
        return this.isAuthenticated;
    }
}

// Export for use in other modules
window.KeychainAuth = KeychainAuth;
