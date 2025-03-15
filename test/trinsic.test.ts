import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TrinsicStrategy } from '../src';
import { Configuration, SessionsApi } from '@trinsic/api';
import { redirect } from 'react-router';

// Mock dependencies
vi.mock('@trinsic/api', () => ({
  Configuration: vi.fn(),
  SessionsApi: vi.fn()
}));

vi.mock('react-router', () => ({
  redirect: vi.fn()
}));

describe('TrinsicStrategy', () => {
  let strategy: TrinsicStrategy<any>;
  let mockVerify = vi.fn();
  let mockCreateWidgetSession = vi.fn();
  let mockGetSessionResult = vi.fn();
  
  const mockOptions = {
    accessToken: 'test-access-token',
    redirectUrl: 'https://example.com/callback'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create strategy
    strategy = new TrinsicStrategy(mockOptions, mockVerify);
    
    // Mock the API methods
    mockCreateWidgetSession = vi.fn();
    mockGetSessionResult = vi.fn();
    
    // Replace the API with our mocked version
    (strategy as any).api = {
      createWidgetSession: mockCreateWidgetSession,
      getSessionResult: mockGetSessionResult
    };
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create a new instance with the correct name', () => {
      expect(strategy.name).toBe('trinsic');
    });

    it('should initialize the Trinsic API with the provided access token', () => {
      // Create a fresh strategy to test constructor behavior
      const freshStrategy = new TrinsicStrategy(mockOptions, mockVerify);
      expect(Configuration).toHaveBeenCalledWith({
        accessToken: mockOptions.accessToken
      });
      expect(SessionsApi).toHaveBeenCalled();
    });
  });

  describe('authenticate', () => {
    it('should initiate sign-in flow when no sessionId and resultsAccessKey are present', async () => {
      const mockLaunchUrl = 'https://trinsic.id/widget?session=123';
      mockCreateWidgetSession.mockResolvedValue({
        launchUrl: mockLaunchUrl,
        sessionId: 'test-session-id'
      });

      const request = new Request('https://example.com/auth/trinsic');
      
      // Mock redirect to throw an error
      (redirect as any).mockImplementation(() => {
        throw new Error('Redirect called');
      });

      await expect(strategy.authenticate(request)).rejects.toThrow('Redirect called');
      expect(mockCreateWidgetSession).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalled();
    });

    it('should handle callback when sessionId and resultsAccessKey are present', async () => {
      const mockSessionId = 'test-session-id';
      const mockResultsAccessKey = 'test-results-access-key';
      const mockUser = { id: '123', name: 'John Doe' };
      
      // Mock the handleCallback method
      vi.spyOn(strategy as any, 'handleCallback').mockResolvedValue(mockUser);

      const request = new Request(
        `https://example.com/auth/trinsic?sessionId=${mockSessionId}&resultsAccessKey=${mockResultsAccessKey}`,
        {
          headers: {
            Cookie: `trinsic-auth-strategy=sessionId=${mockSessionId}`
          }
        }
      );

      const result = await strategy.authenticate(request);
      expect(result).toEqual(mockUser);
    });

    it('should throw an error when sessionId is missing from cookie during callback', async () => {
      const request = new Request(
        'https://example.com/auth/trinsic?sessionId=test-id&resultsAccessKey=test-key',
        { headers: { Cookie: '' } }
      );

      await expect(strategy.authenticate(request)).rejects.toThrow(ReferenceError);
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it('should throw an error when createWidgetSession returns no launchUrl', async () => {
      mockCreateWidgetSession.mockResolvedValue({
        sessionId: 'test-session-id'
        // No launchUrl
      });

      const request = new Request('https://example.com/auth/trinsic');
      await expect(strategy.authenticate(request)).rejects.toThrow('Failed to start sign in flow. No launch URL returned.');
    });

    it('should throw an error when createWidgetSession returns no sessionId', async () => {
      mockCreateWidgetSession.mockResolvedValue({
        launchUrl: 'https://trinsic.id/widget?session=123'
        // No sessionId
      });

      const request = new Request('https://example.com/auth/trinsic');
      await expect(strategy.authenticate(request)).rejects.toThrow('Failed to start sign in flow. No session ID returned.');
    });
  });

  describe('handleSignIn', () => {
    it('should create a widget session and return launch URL and header', async () => {
      const mockLaunchUrl = 'https://trinsic.id/widget?session=123';
      const mockSessionId = 'test-session-id';
      
      mockCreateWidgetSession.mockResolvedValue({
        launchUrl: mockLaunchUrl,
        sessionId: mockSessionId
      });

      const result = await (strategy as any).handleSignIn();
      
      expect(result.launchUrl.toString()).toBe(mockLaunchUrl);
      expect(result.header).toBeDefined();
      expect(mockCreateWidgetSession).toHaveBeenCalledWith({
        redirectUrl: mockOptions.redirectUrl,
        providers: undefined,
        knownIdentityData: undefined
      });
    });
  });
}); 