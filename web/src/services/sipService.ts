/**
 * SIP.js Service for WebRTC Communication
 * Updated for SIP.js v0.21.2 with latest APIs
 */

import { 
  UserAgent, 
  UserAgentOptions,
  Registerer,
  Inviter,
  Invitation,
  SessionState,
  URI,
  Web
} from 'sip.js';

export interface SipConfig {
  server: string;
  username: string;
  password: string;
  domain: string;
  displayName?: string;
}

export interface CallOptions {
  audio: boolean;
  video: boolean;
}

export interface CallSession {
  id: string;
  state: SessionState;
  remoteIdentity: string;
  startTime: Date;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
}

export class SipService {
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private activeSessions: Map<string, any> = new Map();
  private config: SipConfig | null = null;
  
  // Event callbacks
  public onRegistered?: () => void;
  public onUnregistered?: () => void;
  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onIncomingCall?: (invitation: Invitation) => void;
  public onCallStateChange?: (session: CallSession) => void;
  public onRegistrationFailed?: (error: Error) => void;

  /**
   * Initialize SIP service with configuration
   */
  async initialize(config: SipConfig): Promise<void> {
    this.config = config;
    
    try {
      // Create UserAgent with latest SIP.js v0.21.2 configuration
      const userAgentOptions: UserAgentOptions = {
        uri: UserAgent.makeURI(`sip:${config.username}@${config.domain}`)!,
        transportOptions: {
          server: config.server,
          connectionTimeout: 15,
          maxReconnectionAttempts: 5,
          reconnectionTimeout: 4,
          keepAliveInterval: 30,
          traceSip: process.env.NODE_ENV === 'development'
        },
        authorizationUsername: config.username,
        authorizationPassword: config.password,
        displayName: config.displayName || config.username,
        logBuiltinEnabled: process.env.NODE_ENV === 'development',
        delegate: {
          onConnect: () => {
            console.log('SIP UserAgent connected');
            this.onConnected?.();
          },
          onDisconnect: (error?: Error) => {
            console.log('SIP UserAgent disconnected', error);
            this.onDisconnected?.();
          },
          onInvite: (invitation: Invitation) => {
            console.log('Incoming call from:', invitation.remoteIdentity.uri.toString());
            this.handleIncomingCall(invitation);
          }
        }
      };

      this.userAgent = new UserAgent(userAgentOptions);
      
      // Create Registerer
      this.registerer = new Registerer(this.userAgent, {
        expires: 300, // 5 minutes
        extraContactHeaderParams: ['transport=ws']
      });

      // Set up registerer event handlers
      this.registerer.stateChange.addListener((newState) => {
        console.log('Registration state changed:', newState);
        switch (newState) {
          case 'Registered':
            this.onRegistered?.();
            break;
          case 'Unregistered':
            this.onUnregistered?.();
            break;
        }
      });

      console.log('SIP service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SIP service:', error);
      throw error;
    }
  }

  /**
   * Connect and register to SIP server
   */
  async connect(): Promise<void> {
    if (!this.userAgent || !this.registerer) {
      throw new Error('SIP service not initialized');
    }

    try {
      // Start UserAgent
      await this.userAgent.start();
      
      // Register
      await this.registerer.register();
      
      console.log('SIP service connected and registered');
    } catch (error) {
      console.error('Failed to connect SIP service:', error);
      this.onRegistrationFailed?.(error as Error);
      throw error;
    }
  }

  /**
   * Disconnect and unregister from SIP server
   */
  async disconnect(): Promise<void> {
    try {
      // Terminate all active sessions
      this.activeSessions.forEach((session, sessionId) => {
        this.hangupCall(sessionId);
      });

      // Unregister
      if (this.registerer) {
        await this.registerer.unregister();
      }

      // Stop UserAgent
      if (this.userAgent) {
        await this.userAgent.stop();
      }

      console.log('SIP service disconnected');
    } catch (error) {
      console.error('Error disconnecting SIP service:', error);
      throw error;
    }
  }

  /**
   * Make an outgoing call
   */
  async makeCall(targetUri: string, options: CallOptions = { audio: true, video: false }): Promise<string> {
    if (!this.userAgent || !this.config) {
      throw new Error('SIP service not initialized');
    }

    try {
      // Create target URI
      const target = UserAgent.makeURI(`sip:${targetUri}@${this.config.domain}`);
      if (!target) {
        throw new Error('Invalid target URI');
      }

      // Get user media
      const constraints: MediaStreamConstraints = {
        audio: options.audio,
        video: options.video
      };

      const localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create Inviter with media constraints
      const inviter = new Inviter(this.userAgent, target, {
        sessionDescriptionHandlerOptions: {
          constraints: constraints
        },
        delegate: {
          onCallHold: () => console.log('Call on hold'),
          onCallUnhold: () => console.log('Call resumed')
        }
      });

      // Set up session event handlers
      this.setupSessionHandlers(inviter, localStream);

      // Store session
      const sessionId = this.generateSessionId();
      this.activeSessions.set(sessionId, inviter);

      // Send INVITE
      await inviter.invite({
        requestDelegate: {
          onAccept: () => {
            console.log('Call accepted');
            this.updateCallSession(sessionId, inviter);
          },
          onReject: () => {
            console.log('Call rejected');
            this.activeSessions.delete(sessionId);
          }
        }
      });

      return sessionId;
    } catch (error) {
      console.error('Failed to make call:', error);
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(sessionId: string, options: CallOptions = { audio: true, video: false }): Promise<void> {
    const invitation = this.activeSessions.get(sessionId);
    if (!invitation || !(invitation instanceof Invitation)) {
      throw new Error('Invalid session ID or session not found');
    }

    try {
      // Get user media
      const constraints: MediaStreamConstraints = {
        audio: options.audio,
        video: options.video
      };

      const localStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Set up session handlers
      this.setupSessionHandlers(invitation, localStream);

      // Accept the invitation
      await invitation.accept({
        sessionDescriptionHandlerOptions: {
          constraints: constraints
        }
      });

      console.log('Call answered');
      this.updateCallSession(sessionId, invitation);
    } catch (error) {
      console.error('Failed to answer call:', error);
      throw error;
    }
  }

  /**
   * Reject an incoming call
   */
  async rejectCall(sessionId: string): Promise<void> {
    const invitation = this.activeSessions.get(sessionId);
    if (!invitation || !(invitation instanceof Invitation)) {
      throw new Error('Invalid session ID or session not found');
    }

    try {
      await invitation.reject();
      this.activeSessions.delete(sessionId);
      console.log('Call rejected');
    } catch (error) {
      console.error('Failed to reject call:', error);
      throw error;
    }
  }

  /**
   * Hang up a call
   */
  async hangupCall(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      // Terminate the session
      switch (session.state) {
        case SessionState.Initial:
        case SessionState.Establishing:
          await session.cancel();
          break;
        case SessionState.Established:
          await session.bye();
          break;
        default:
          console.log('Session already terminated');
      }

      this.activeSessions.delete(sessionId);
      console.log('Call hung up');
    } catch (error) {
      console.error('Failed to hang up call:', error);
      throw error;
    }
  }

  /**
   * Hold/Unhold a call
   */
  async toggleHold(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.state !== SessionState.Established) {
      throw new Error('No established session found');
    }

    try {
      const sessionDescriptionHandler = session.sessionDescriptionHandler;
      if (sessionDescriptionHandler.localHold) {
        await sessionDescriptionHandler.unhold();
        console.log('Call resumed');
      } else {
        await sessionDescriptionHandler.hold();
        console.log('Call on hold');
      }
    } catch (error) {
      console.error('Failed to toggle hold:', error);
      throw error;
    }
  }

  /**
   * Mute/Unmute audio
   */
  async toggleMute(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.state !== SessionState.Established) {
      throw new Error('No established session found');
    }

    try {
      const sessionDescriptionHandler = session.sessionDescriptionHandler;
      if (sessionDescriptionHandler.localMediaStream) {
        const audioTracks = sessionDescriptionHandler.localMediaStream.getAudioTracks();
        audioTracks.forEach(track => {
          track.enabled = !track.enabled;
        });
        console.log(`Audio ${audioTracks[0]?.enabled ? 'unmuted' : 'muted'}`);
      }
    } catch (error) {
      console.error('Failed to toggle mute:', error);
      throw error;
    }
  }

  /**
   * Send DTMF tones
   */
  async sendDTMF(sessionId: string, tone: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.state !== SessionState.Established) {
      throw new Error('No established session found');
    }

    try {
      const options = {
        requestOptions: {
          body: {
            contentDisposition: 'render',
            contentType: 'application/dtmf-relay',
            content: `Signal=${tone}\r\nDuration=100`
          }
        }
      };

      await session.info(options);
      console.log(`DTMF tone sent: ${tone}`);
    } catch (error) {
      console.error('Failed to send DTMF:', error);
      throw error;
    }
  }

  /**
   * Get active call sessions
   */
  getActiveSessions(): CallSession[] {
    const sessions: CallSession[] = [];
    this.activeSessions.forEach((session, sessionId) => {
      sessions.push({
        id: sessionId,
        state: session.state,
        remoteIdentity: session.remoteIdentity?.uri?.toString() || 'Unknown',
        startTime: session.startTime || new Date(),
        localStream: session.sessionDescriptionHandler?.localMediaStream,
        remoteStream: session.sessionDescriptionHandler?.remoteMediaStream
      });
    });
    return sessions;
  }

  /**
   * Check if registered
   */
  isRegistered(): boolean {
    return this.registerer?.state === 'Registered';
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.userAgent?.state === 'Started';
  }

  // Private helper methods

  private handleIncomingCall(invitation: Invitation): void {
    const sessionId = this.generateSessionId();
    this.activeSessions.set(sessionId, invitation);
    
    // Set up basic event handlers for incoming call
    invitation.stateChange.addListener((newState) => {
      console.log(`Incoming call state changed to: ${newState}`);
      if (newState === SessionState.Terminated) {
        this.activeSessions.delete(sessionId);
      }
    });

    this.onIncomingCall?.(invitation);
  }

  private setupSessionHandlers(session: any, localStream?: MediaStream): void {
    // Handle session state changes
    session.stateChange.addListener((newState: SessionState) => {
      console.log(`Session state changed to: ${newState}`);
      
      if (newState === SessionState.Established) {
        // Call established
        const sessionDescriptionHandler = session.sessionDescriptionHandler;
        if (localStream) {
          sessionDescriptionHandler.localMediaStream = localStream;
        }
        
        // Get remote stream
        const remoteStream = sessionDescriptionHandler.remoteMediaStream;
        if (remoteStream) {
          // Handle remote stream (e.g., attach to video element)
          console.log('Remote stream available');
        }
      } else if (newState === SessionState.Terminated) {
        // Call terminated, cleanup
        this.cleanupSession(session);
      }

      // Notify state change
      const sessionId = this.getSessionId(session);
      if (sessionId) {
        this.updateCallSession(sessionId, session);
      }
    });
  }

  private updateCallSession(sessionId: string, session: any): void {
    const callSession: CallSession = {
      id: sessionId,
      state: session.state,
      remoteIdentity: session.remoteIdentity?.uri?.toString() || 'Unknown',
      startTime: session.startTime || new Date(),
      localStream: session.sessionDescriptionHandler?.localMediaStream,
      remoteStream: session.sessionDescriptionHandler?.remoteMediaStream
    };

    this.onCallStateChange?.(callSession);
  }

  private cleanupSession(session: any): void {
    const sessionId = this.getSessionId(session);
    if (sessionId) {
      this.activeSessions.delete(sessionId);
    }

    // Cleanup media streams
    const sessionDescriptionHandler = session.sessionDescriptionHandler;
    if (sessionDescriptionHandler) {
      const localStream = sessionDescriptionHandler.localMediaStream;
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getSessionId(session: any): string | null {
    for (const [sessionId, storedSession] of this.activeSessions) {
      if (storedSession === session) {
        return sessionId;
      }
    }
    return null;
  }
}

// Singleton instance
export const sipService = new SipService();
