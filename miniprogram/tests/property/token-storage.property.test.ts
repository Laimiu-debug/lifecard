/// <reference types="jest" />
/**
 * Property-Based Tests for Token Storage Consistency
 * Feature: life-card-miniprogram, Property 1: Token Storage Consistency
 * Validates: Requirements 1.4, 1.6
 */
import * as fc from 'fast-check';
import { Storage, StorageKeys } from '../../utils/storage';

// 获取全局 wx 对象 (由 tests/setup.ts 设置)
declare const wx: {
  getStorageSync: jest.Mock;
  setStorageSync: jest.Mock;
  removeStorageSync: jest.Mock;
};

describe('Token Storage Consistency Properties', () => {
  let storageInstance: Storage;
  let mockStorage: Record<string, any>;

  beforeEach(() => {
    storageInstance = new Storage();
    mockStorage = {};

    // 设置 mock 实现
    (wx.getStorageSync as jest.Mock).mockImplementation((key: string) => {
      return mockStorage[key];
    });

    (wx.setStorageSync as jest.Mock).mockImplementation((key: string, value: any) => {
      mockStorage[key] = value;
    });

    (wx.removeStorageSync as jest.Mock).mockImplementation((key: string) => {
      delete mockStorage[key];
    });
  });

  // Arbitrary for valid JWT-like tokens (non-empty strings)
  const validTokenArb = fc.string({ minLength: 1, maxLength: 2048 })
    .filter(s => s.trim().length > 0);

  // Arbitrary for positive expiration time in seconds (1 second to 30 days)
  const validExpiresInArb = fc.integer({ min: 1, max: 30 * 24 * 60 * 60 });

  /**
   * Property 1.1: Token round-trip consistency
   * For any valid JWT token, storing and then retrieving SHALL return the same token value
   * Validates: Requirements 1.4
   */
  it('should return the same token value after store and retrieve', () => {
    fc.assert(
      fc.property(
        validTokenArb,
        (token) => {
          // Store the token
          storageInstance.setToken(token);
          
          // Retrieve the token
          const retrievedToken = storageInstance.getToken();
          
          // Should be the same
          return retrievedToken === token;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.2: Token with expiration round-trip consistency
   * For any valid token and expiration time, storing and immediately retrieving SHALL return the same token
   * Validates: Requirements 1.4, 1.6
   */
  it('should return the same token when stored with expiration and retrieved before expiry', () => {
    fc.assert(
      fc.property(
        validTokenArb,
        validExpiresInArb,
        (token, expiresIn) => {
          // Store the token with expiration
          storageInstance.setToken(token, expiresIn);
          
          // Retrieve immediately (before expiry)
          const retrievedToken = storageInstance.getToken();
          
          // Should be the same
          return retrievedToken === token;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.3: Expired token returns null
   * For any token stored with past expiration, retrieval SHALL return null
   * Validates: Requirements 1.6
   */
  it('should return null for expired tokens', () => {
    fc.assert(
      fc.property(
        validTokenArb,
        (token) => {
          // Directly set an expired token in storage
          mockStorage[StorageKeys.TOKEN] = {
            token,
            expires_at: Date.now() - 1000, // 1 second in the past
          };
          
          // Retrieve should return null
          const retrievedToken = storageInstance.getToken();
          
          return retrievedToken === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.4: Token overwrite consistency
   * For any two tokens, storing the second SHALL overwrite the first
   * Validates: Requirements 1.4
   */
  it('should overwrite previous token when storing a new one', () => {
    fc.assert(
      fc.property(
        validTokenArb,
        validTokenArb,
        (token1, token2) => {
          // Store first token
          storageInstance.setToken(token1);
          
          // Store second token (overwrite)
          storageInstance.setToken(token2);
          
          // Retrieve should return the second token
          const retrievedToken = storageInstance.getToken();
          
          return retrievedToken === token2;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.5: Clear token consistency
   * For any stored token, clearing SHALL result in null retrieval
   * Validates: Requirements 1.4
   */
  it('should return null after clearing token', () => {
    fc.assert(
      fc.property(
        validTokenArb,
        (token) => {
          // Store the token
          storageInstance.setToken(token);
          
          // Clear the token
          storageInstance.clearToken();
          
          // Retrieve should return null
          const retrievedToken = storageInstance.getToken();
          
          return retrievedToken === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1.6: Token storage idempotence
   * For any token, storing it multiple times SHALL result in the same retrieval
   * Validates: Requirements 1.4
   */
  it('should be idempotent when storing the same token multiple times', () => {
    fc.assert(
      fc.property(
        validTokenArb,
        fc.integer({ min: 2, max: 10 }),
        (token, times) => {
          // Store the same token multiple times
          for (let i = 0; i < times; i++) {
            storageInstance.setToken(token);
          }
          
          // Retrieve should return the token
          const retrievedToken = storageInstance.getToken();
          
          return retrievedToken === token;
        }
      ),
      { numRuns: 100 }
    );
  });
});
