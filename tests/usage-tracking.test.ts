import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract interactions
const mockContractCall = vi.fn();
const mockTxSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

// Mock the contract state
let contractState = {
  admin: mockTxSender,
  usageRecords: new Map(),
  usageIdCounter: 0,
  usageTypes: new Map()
};

// Mock contract functions
const mockContract = {
  isAdmin: () => contractState.admin === mockTxSender,
  
  registerUsageType: (typeId, name, description) => {
    if (!mockContract.isAdmin()) {
      return { error: 100 }; // ERR-NOT-AUTHORIZED
    }
    
    contractState.usageTypes.set(typeId, {
      name,
      description,
      active: true
    });
    
    return { value: true };
  },
  
  deactivateUsageType: (typeId) => {
    if (!mockContract.isAdmin()) {
      return { error: 100 }; // ERR-NOT-AUTHORIZED
    }
    
    if (!contractState.usageTypes.has(typeId)) {
      return { error: 101 }; // ERR-USAGE-TYPE-NOT-FOUND
    }
    
    const typeData = contractState.usageTypes.get(typeId);
    typeData.active = false;
    contractState.usageTypes.set(typeId, typeData);
    
    return { value: true };
  },
  
  recordUsage: (datasetId, usageType, details) => {
    if (!contractState.usageTypes.has(usageType)) {
      return { error: 101 }; // ERR-USAGE-TYPE-NOT-FOUND
    }
    
    const newId = contractState.usageIdCounter + 1;
    contractState.usageIdCounter = newId;
    
    contractState.usageRecords.set(newId, {
      datasetId,
      user: mockTxSender,
      usageType,
      timestamp: 123, // Mock block height
      details
    });
    
    return { value: newId };
  },
  
  getUsageType: (typeId) => {
    return contractState.usageTypes.get(typeId) || null;
  },
  
  getUsageRecord: (recordId) => {
    return contractState.usageRecords.get(recordId) || null;
  },
  
  getDatasetUsage: (datasetId, recordId) => {
    const record = contractState.usageRecords.get(recordId);
    if (record && record.datasetId === datasetId) {
      return record;
    }
    return null;
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

describe('Usage Tracking Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    contractState = {
      admin: mockTxSender,
      usageRecords: new Map(),
      usageIdCounter: 0,
      usageTypes: new Map()
    };
    mockContractCall.mockReset();
  });
  
  it('should register a usage type successfully', () => {
    const result = mockContract.registerUsageType(1, 'Research', 'Used for medical research');
    expect(result).toEqual({ value: true });
    
    const typeData = contractState.usageTypes.get(1);
    expect(typeData).toBeDefined();
    expect(typeData.name).toBe('Research');
    expect(typeData.description).toBe('Used for medical research');
    expect(typeData.active).toBe(true);
  });
  
  it('should deactivate a usage type successfully', () => {
    // First register
    mockContract.registerUsageType(1, 'Research', 'Used for medical research');
    
    // Then deactivate
    const result = mockContract.deactivateUsageType(1);
    expect(result).toEqual({ value: true });
    
    const typeData = contractState.usageTypes.get(1);
    expect(typeData.active).toBe(false);
  });
  
  it('should fail to deactivate a non-existent usage type', () => {
    const result = mockContract.deactivateUsageType(999);
    expect(result).toEqual({ error: 101 }); // ERR-USAGE-TYPE-NOT-FOUND
  });
  
  it('should record usage successfully', () => {
    // First register a usage type
    mockContract.registerUsageType(1, 'Research', 'Used for medical research');
    
    // Then record usage
    const result = mockContract.recordUsage(1, 1, 'Analyzing cancer data');
    expect(result).toEqual({ value: 1 });
    
    const recordData = contractState.usageRecords.get(1);
    expect(recordData).toBeDefined();
    expect(recordData.datasetId).toBe(1);
    expect(recordData.usageType).toBe(1);
    expect(recordData.user).toBe(mockTxSender);
    expect(recordData.details).toBe('Analyzing cancer data');
  });
  
  it('should fail to record usage with non-existent type', () => {
    const result = mockContract.recordUsage(1, 999, 'Analyzing cancer data');
    expect(result).toEqual({ error: 101 }); // ERR-USAGE-TYPE-NOT-FOUND
  });
  
  it('should get dataset usage correctly', () => {
    // First register a usage type
    mockContract.registerUsageType(1, 'Research', 'Used for medical research');
    
    // Then record usage
    mockContract.recordUsage(1, 1, 'Analyzing cancer data');
    
    // Get dataset usage
    const usage = mockContract.getDatasetUsage(1, 1);
    expect(usage).toBeDefined();
    expect(usage.datasetId).toBe(1);
    expect(usage.usageType).toBe(1);
    expect(usage.details).toBe('Analyzing cancer data');
    
    // Try to get usage for a different dataset
    const wrongUsage = mockContract.getDatasetUsage(2, 1);
    expect(wrongUsage).toBeNull();
  });
});
