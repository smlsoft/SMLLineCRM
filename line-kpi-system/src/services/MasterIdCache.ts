import { Employee, IEmployee } from '../models/Employee';

interface CachedEmployee {
  _id: string;
  lineUserId: string;
  name: string;
  employeeCode: string;
  department?: string;
  assignedGroupIds: string[];
}

/**
 * In-memory cache of employee LINE user IDs (Master IDs).
 * Loaded at startup, refreshed whenever the employee list changes via API.
 * O(1) lookup per message — no DB hit on the hot path.
 */
class MasterIdCache {
  private cache = new Map<string, CachedEmployee>();
  private initialized = false;

  async initialize(): Promise<void> {
    const employees = await Employee.find({ isActive: true })
      .select('lineUserId name employeeCode department assignedGroupIds')
      .lean<IEmployee[]>();

    this.cache.clear();
    for (const emp of employees) {
      this.cache.set(emp.lineUserId, {
        _id: emp._id.toString(),
        lineUserId: emp.lineUserId,
        name: emp.name,
        employeeCode: emp.employeeCode,
        department: emp.department,
        assignedGroupIds: emp.assignedGroupIds.map((id) => id.toString()),
      });
    }

    this.initialized = true;
    console.log(`[MasterIdCache] Loaded ${this.cache.size} employees`);
  }

  async refresh(): Promise<void> {
    await this.initialize();
  }

  isEmployee(lineUserId: string): boolean {
    return this.cache.has(lineUserId);
  }

  getEmployee(lineUserId: string): CachedEmployee | undefined {
    return this.cache.get(lineUserId);
  }

  get size(): number {
    return this.cache.size;
  }

  get isReady(): boolean {
    return this.initialized;
  }
}

// Singleton — shared across the application
export const masterIdCache = new MasterIdCache();
