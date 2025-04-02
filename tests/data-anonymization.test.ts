import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Clarity contract interactions
const mockContractCall = vi.fn();
const mockTxSender = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

// Mock the contract state
let contractState = {
  admin: mockTxSender,
  anonymizationMethods: new Map(),
  anonymizedDatasets: new Map(),
  datasetIdCounter: 0
};

// Mock contract functions
const mockContract = {
  isAdmin: () => contractState.admin === mockTxSender,
  
  registerAnonymizationMethod: (methodId, name, description) => {
    if (!mockContract.isAdmin()) {
      return { error: 100 }; // ERR-NOT-AUTHORIZED
    }
    
    contractState.anonymizationMethods.set(methodId, {
      name,
      description,
      active: true
    });
    
    return { value: true };
  },
  
  deactivateAnonymizationMethod: (methodId) => {
    if (!mockContract.isAdmin()) {
      return { error: 100 }; // ERR-NOT-AUTHORIZED
    }
    
    if (!contractState.anonymizationMethods.has(methodId)) {
      return { error: 101 }; // ERR-METHOD-NOT-FOUND
    }
    
    const methodData = contractState.anonymizationMethods.get(methodId);
    methodData.active = false;
    contractState.anonymizationMethods.set(methodId, methodData);
    
    return { value: true };
  },
  
  registerAnonymizedDataset: (originalHash, anonymizedHash, methodId) => {
    if (!contractState.anonymizationMethods.has(methodId)) {
      return { error: 101 }; // ERR-METHOD-NOT-FOUND
    }
    
    const newId = contractState.datasetIdCounter + 1;
    contractState.datasetIdCounter = newId;
    
    contractState.anonymizedDatasets.set(newId, {
      originalHash,
      anonymizedHash,
      methodId,
      anonymizer: mockTxSender,
      timestamp: 123 // Mock block height
    });
    
    return { value: newId };
  },
  
  getAnonymizationMethod: (methodId) => {
    return contractState.anonymizationMethods.get(methodId) || null;
  },
  
  getAnonymizedDataset: (datasetId) => {
    return contractState.anonymizedDatasets.get(datasetId) || null;
  },
  
  verifyAnonymization: (datasetId, claimedHash) => {
    if (!contractState.anonymizedDatasets.has(datasetId)) {
      return { error: 102 }; // ERR-DATASET-NOT-FOUND
    }
    
    const dataset = contractState.anonymizedDatasets.get(datasetId);
    return { value: dataset.anonymizedHash === claimedHash };
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

describe('Data Anonymization Contract', () => {
  beforeEach(() => {
    // Reset the contract state before each test
    contractState = {
      admin: mockTxSender,
      anonymizationMethods: new Map(),
      anonymizedDatasets: new Map(),
      datasetIdCounter: 0
    };
    mockContractCall.mockReset();
  });
  
  it('should register an anonymization method successfully', () => {
    const result = mockContract.registerAnonymizationMethod(1, 'Differential Privacy', 'Adds noise to data');
    expect(result).toEqual({ value: true });
    
    const methodData = contractState.anonymizationMethods.get(1);
    expect(methodData).toBeDefined();
    expect(methodData.name).toBe('Differential Privacy');
    expect(methodData.description).toBe('Adds noise to data');
    expect(methodData.active).toBe(true);
  });
  
  it('should deactivate an anonymization method successfully', () => {
    // First register
    mockContract.registerAnonymizationMethod(1, 'Differential Privacy', 'Adds noise to data');
    
    // Then deactivate
    const result = mockContract.deactivateAnonymizationMethod(1);
    expect(result).toEqual({ value: true });
    
    const methodData = contractState.anonymizationMethods.get(1);
    expect(methodData.active).toBe(false);
  });
  
  it('should fail to deactivate a non-existent method', () => {
    const result = mockContract.deactivateAnonymizationMethod(999);
    expect(result).toEqual({ error: 101 }); // ERR-METHOD-NOT-FOUND
  });
  
  it('should register an anonymized dataset successfully', () => {
    // First register a method
    mockContract.registerAnonymizationMethod(1, 'Differential Privacy', 'Adds noise to data');
    
    // Then register a dataset
    const originalHash = 'original-hash-buffer';
    const anonymizedHash = 'anonymized-hash-buffer';
    const result = mockContract.registerAnonymizedDataset(originalHash, anonymizedHash, 1);
    expect(result).toEqual({ value: 1 });
    
    const datasetData = contractState.anonymizedDatasets.get(1);
    expect(datasetData).toBeDefined();
    expect(datasetData.originalHash).toBe(originalHash);
    expect(datasetData.anonymizedHash).toBe(anonymizedHash);
    expect(datasetData.methodId).toBe(1);
    expect(datasetData.anonymizer).toBe(mockTxSender);
  });
  
  it('should fail to register a dataset with non-existent method', () => {
    const originalHash = 'original-hash-buffer';
    const anonymizedHash = 'anonymized-hash-buffer';
    const result = mockContract.registerAnonymizedDataset(originalHash, anonymizedHash, 999);
    expect(result).toEqual({ error: 101 }); // ERR-METHOD-NOT-FOUND
  });
  
  it('should verify anonymization successfully', () => {
    // First register a method
    mockContract.registerAnonymizationMethod(1, 'Differential Privacy', 'Adds noise to data');
    
    // Then register a dataset
    const originalHash = 'original-hash-buffer';
    const anonymizedHash = 'anonymized-hash-buffer';
    mockContract.registerAnonymizedDataset(originalHash, anonymizedHash, 1);
    
    // Verify with correct hash
    let result = mockContract.verifyAnonymization(1, anonymizedHash);
    expect(result).toEqual({ value: true });
    
    // Verify with incorrect hash
    result = mockContract.verifyAnonymization(1, 'wrong-hash');
    expect(result).toEqual({ value: false });
  });
  
  it('should fail to verify a non-existent dataset', () => {
    const result = mockContract.verifyAnonymization(999, 'some-hash');
    expect(result).toEqual({ error: 102 }); // ERR-DATASET-NOT-FOUND
  });
});
