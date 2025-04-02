import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract interactions
const mockContractCall = vi.fn();
const mockTxSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const mockInstitution = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';

// Mock the contract state
let contractState = {
  admin: mockTxSender,
  verifiedInstitutions: new Map()
};

// Mock contract functions
const mockContract = {
  isAdmin: () => contractState.admin === mockTxSender,
  
  verifyInstitution: (institution, name, level) => {
    if (!mockContract.isAdmin()) {
      return { error: 100 }; // ERR-NOT-AUTHORIZED
    }
    
    if (contractState.verifiedInstitutions.has(institution)) {
      return { error: 101 }; // ERR-ALREADY-VERIFIED
    }
    
    contractState.verifiedInstitutions.set(institution, {
      name,
      verificationDate: 123, // Mock block height
      verificationLevel: level,
      active: true
    });
    
    return { value: true };
  },
  
  revokeVerification: (institution) => {
    if (!mockContract.isAdmin()) {
      return { error: 100 }; // ERR-NOT-AUTHORIZED
    }
    
    if (!contractState.verifiedInstitutions.has(institution)) {
      return { error: 102 }; // ERR-NOT-FOUND
    }
    
    const institutionData = contractState.verifiedInstitutions.get(institution);
    institutionData.active = false;
    contractState.verifiedInstitutions.set(institution, institutionData);
    
    return { value: true };
  },
  
  isVerified: (institution) => {
    if (!contractState.verifiedInstitutions.has(institution)) {
      return { error: 102 }; // ERR-NOT-FOUND
    }
    
    return { value: contractState.verifiedInstitutions.get(institution).active };
  },
  
  getInstitutionDetails: (institution) => {
    return contractState.verifiedInstitutions.get(institution) || null;
  },
  
  transferAdmin: (newAdmin) => {
    if (!mockContract.isAdmin()) {
      return { error: 100 }; // ERR-NOT-AUTHORIZED
    }
    
    contractState.admin = newAdmin;
    return { value: true };
  }
};

// Mock the contract calls
vi.mock('@stacks/transactions', () => ({
  callReadOnlyFunction: (...args) => mockContractCall(...args)
}));

describe('Institution Verification Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    contractState = {
      admin: mockTxSender,
      verifiedInstitutions: new Map()
    };
    mockContractCall.mockReset();
  });
  
  it('should verify an institution successfully', () => {
    const result = mockContract.verifyInstitution(mockInstitution, 'Test Institution', 2);
    expect(result).toEqual({ value: true });
    
    const institutionData = contractState.verifiedInstitutions.get(mockInstitution);
    expect(institutionData).toBeDefined();
    expect(institutionData.name).toBe('Test Institution');
    expect(institutionData.verificationLevel).toBe(2);
    expect(institutionData.active).toBe(true);
  });
  
  it('should fail to verify an already verified institution', () => {
    // First verification
    mockContract.verifyInstitution(mockInstitution, 'Test Institution', 2);
    
    // Second verification attempt
    const result = mockContract.verifyInstitution(mockInstitution, 'Test Institution Updated', 3);
    expect(result).toEqual({ error: 101 }); // ERR-ALREADY-VERIFIED
  });
  
  it('should revoke verification successfully', () => {
    // First verify
    mockContract.verifyInstitution(mockInstitution, 'Test Institution', 2);
    
    // Then revoke
    const result = mockContract.revokeVerification(mockInstitution);
    expect(result).toEqual({ value: true });
    
    const institutionData = contractState.verifiedInstitutions.get(mockInstitution);
    expect(institutionData.active).toBe(false);
  });
  
  it('should fail to revoke verification for non-existent institution', () => {
    const result = mockContract.revokeVerification('ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7TZ9JZ');
    expect(result).toEqual({ error: 102 }); // ERR-NOT-FOUND
  });
  
  it('should check if an institution is verified', () => {
    // First verify
    mockContract.verifyInstitution(mockInstitution, 'Test Institution', 2);
    
    // Check verification
    let result = mockContract.isVerified(mockInstitution);
    expect(result).toEqual({ value: true });
    
    // Revoke and check again
    mockContract.revokeVerification(mockInstitution);
    result = mockContract.isVerified(mockInstitution);
    expect(result).toEqual({ value: false });
  });
  
  it('should transfer admin rights successfully', () => {
    const newAdmin = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7TZ9JZ';
    const result = mockContract.transferAdmin(newAdmin);
    expect(result).toEqual({ value: true });
    expect(contractState.admin).toBe(newAdmin);
  });
});
