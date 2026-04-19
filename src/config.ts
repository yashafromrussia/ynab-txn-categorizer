import * as fs from 'fs';
import * as path from 'path';
import { PatternRule } from './pattern-engine.js';

export interface AppConfig {
    ambiguousPayees: string[];
    amountTolerance?: number;
    dateWindowDays?: number;
    requireCrossAccount?: boolean;
    minConfidence?: number;
    knownCategories: Record<string, string[]>;
    rules: PatternRule[];
}

const DEFAULT_CONFIG: AppConfig = {
    ambiguousPayees: ['Apple', 'Amazon', 'PayPal', 'Stripe', 'Google', 'Square'],
    amountTolerance: 500,
    dateWindowDays: 30,
    requireCrossAccount: true,
    minConfidence: 0.8,
    knownCategories: {
        'Dining': ['restaurant', 'coffee', 'cafe', 'food', 'steak'],
        'Groceries': ['grocery', 'supermarket', 'market', 'coles', 'grocer'],
        'Travel': ['flight', 'airline', 'hotel', 'motel', 'resort'],
        'Entertainment': ['movie', 'theater', 'tickets', 'concert']
    },
    rules: []
};

export class ConfigManager {
    private configPath: string;
    private config: AppConfig;

    constructor(customPath?: string) {
        this.configPath = customPath || path.join(process.cwd(), 'config.json');
        this.config = this.loadConfig();
    }

    private loadConfig(): AppConfig {
        if (fs.existsSync(this.configPath)) {
            try {
                const data = fs.readFileSync(this.configPath, 'utf-8');
                const parsed = JSON.parse(data);
                // Merge with defaults to ensure all fields exist
                return { ...DEFAULT_CONFIG, ...parsed };
            } catch (err) {
                console.error(`Failed to parse config at ${this.configPath}, using defaults`, err);
                return { ...DEFAULT_CONFIG };
            }
        } else {
            // Write defaults if file doesn't exist
            fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
            return { ...DEFAULT_CONFIG };
        }
    }

    public saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        } catch (error) {
            console.error('Failed to save config', error);
        }
    }

    public getConfig(): AppConfig {
        return this.config;
    }

    public addAmbiguousPayee(payee: string) {
        if (!this.config.ambiguousPayees.includes(payee)) {
            this.config.ambiguousPayees.push(payee);
            this.saveConfig();
        }
    }
}
