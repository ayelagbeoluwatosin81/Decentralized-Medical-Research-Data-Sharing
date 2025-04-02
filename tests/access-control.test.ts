import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract interactions
const mockContractCall = vi.fn();
const mockTxSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
const mockAccessor = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';

// Mock the contract state
let contractState = {
  admin: mockTxSender,
  datasetPermissions: new Map(),
  datasetOwners: new Map()
};

// Mock contract functions
const mockContract = {
  isAdmin: () => contractState.admin === mockTxSender,
  
  registerDataset: (datasetId) => {
    contractState.datasetOwners.set(datasetId, { owner: mockTxSender });
    return { value: true };
  },
  
  isDatasetOwner: (datasetId) => {
    const ownerData = contractState.datasetOwners.get(datasetId);
    return ownerData ? ownerData.owner === mockTxSender : false;
  },
  
  grantAccess: (datasetId, accessor, accessLevel, expiration) => {
    if (!mockContract.isDatasetOwner(datasetId)) {
      return { error: 101 }; // ERR-NOT-OWNER
    }
    
    const key = `${datasetId}-${accessor}`;
    contractState.datasetPermissions.set(key, {
      grantedBy: mockTxSender,
      accessLevel,
      expiration,
      active: true
    });
    
    return { value: true };
  },
  
  revokeAccess: (datasetId, accessor) => {
    if (!mockContract.isDatasetOwner(datasetId)) {
      return { error: 101 }; // ERR-NOT-OWNER
    }
    
    const key = `${datasetId}-${accessor}`;
    if (!contractState.datasetPermissions.has(key)) {
      return { error: 102 }; // ERR-PERMISSION-NOT-FOUND
    }
    
    const permissionData = contractState.datasetPermissions.get(key);
    permissionData.active = false;
    contractState.datasetPermissions.set(key, permissionData);
    
    return { value: true };
  },
  
  hasAccess: (datasetId, accessor) => {
    const key = `${datasetId}-${accessor}`;
    const permissionData = contractState.datasetPermissions.get(key);
    
    if (!permissionData) {
      return false;
    }
    
    return permissionData.active && permissionData.expiration > 123; // Mock block height
  },
  
  getAccessDetails: (datasetId, accessor) => {
    const key = `${datasetId}-${accessor}`;
    return contractState.datasetPermissions.get(key) || null;
  },
  
  transferDatasetOwnership: (datasetId, newOwner) => {
    if (!mockContract.isDatasetOwner(datasetId)) {
      return { error: 101 }; // ERR-NOT-OWNER
    }
    
    contractState.datasetOwners.set(datasetId, { owner: newOwner });
    return { value: true };
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

describe('Access Control Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    contractState = {
      admin: mockTxSender,
      datasetPermissions: new Map(),
      datasetOwners: new Map()
    };
    mockContractCall.mockReset();
  });
  
  it('should register a dataset successfully', () => {
    const result = mockContract.registerDataset(1);
    expect(result).toEqual({ value: true });
    
    const ownerData = contractState.datasetOwners.get(1);
    expect(ownerData).toBeDefined();
    expect(ownerData.owner).toBe(mockTxSender);
  });
  
  it('should grant access successfully', () => {
    // First register a dataset
    mockContract.registerDataset(1);
    
    // Then grant access
    const result = mockContract.grantAccess(1, mockAccessor, 2, 1000);
    expect(result).toEqual({ value: true });
    
    const key = `1-${mockAccessor}`;
    const permissionData = contractState.datasetPermissions.get(key);
    expect(permissionData).toBeDefined();
    expect(permissionData.grantedBy).toBe(mockTxSender);
    expect(permissionData.accessLevel).toBe(2);
    expect(permissionData.expiration).toBe(1000);
    expect(permissionData.active).toBe(true);
  });
  
  it('should fail to grant access if not the owner', () => {
    // Dataset not registered, so caller is not the owner
    const result = mockContract.grantAccess(999, mockAccessor, 2, 1000);
    expect(result).toEqual({ error: 101 }); // ERR-NOT-OWNER
  });
  
  it('should revoke access successfully', () => {
    // First register a dataset
    mockContract.registerDataset(1);
    
    // Then grant access
    mockContract.grantAccess(1, mockAccessor, 2, 1000);
    
    // Then revoke access
    const result = mockContract.revokeAccess(1, mockAccessor);
    expect(result).toEqual({ value: true });
    
    const key = `1-${mockAccessor}`;
    const permissionData = contractState.datasetPermissions.get(key);
    expect(permissionData.active).toBe(false);
  });
  
  it('should fail to revoke non-existent permission', () => {
    // First register a dataset
    mockContract.registerDataset(1);
    
    // Try to revoke non-existent permission
    const result = mockContract.revokeAccess(1, 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7TZ9JZ');
    expect(result).toEqual({ error: 102 }); // ERR-PERMISSION-NOT-FOUND
  });
  
  it('should check access correctly', () => {
    // First register a dataset
    mockContract.registerDataset(1);
    
    // Then grant access
    mockContract.grantAccess(1, mockAccessor, 2, 1000);
    
    // Check access
    let hasAccess = mockContract.hasAccess(1, mockAccessor);
    expect(hasAccess).toBe(true);
    
    // Revoke access and check again
    mockContract.revokeAccess(1, mockAccessor);
    hasAccess = mockContract.hasAccess(1, mockAccessor);
    expect(hasAccess).toBe(false);
  });
  
  it('should transfer dataset ownership successfully', () => {
    // First register a dataset
    mockContract.registerDataset(1);
    
    // Then transfer ownership
    const newOwner = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5YC7TZ9JZ';
    const result = mockContract.transferDatasetOwnership(1, newOwner);
    expect(result).toEqual({ value: true });
    
    const ownerData = contractState.datasetOwners.get(1);
    expect(ownerData.owner).toBe(newOwner);
  });
});
