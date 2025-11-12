// Storage interface for future use
// Currently not needed as summaries are generated on-demand without persistence

export interface IStorage {
  // Add storage methods here if needed
}

export class MemStorage implements IStorage {
  constructor() {
    // Initialize storage if needed
  }
}

export const storage = new MemStorage();
