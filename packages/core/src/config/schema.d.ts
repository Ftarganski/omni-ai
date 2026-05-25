import { z } from "zod";
export declare const ProviderConfigSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["anthropic", "openai", "copilot", "custom"]>;
    apiKey: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | undefined, string | null | undefined>;
    baseUrl: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | undefined, string | null | undefined>;
    defaultModel: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | undefined, string | null | undefined>;
    options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "custom" | "anthropic" | "openai" | "copilot";
    options?: Record<string, unknown> | undefined;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
}, {
    name: string;
    type: "custom" | "anthropic" | "openai" | "copilot";
    options?: Record<string, unknown> | undefined;
    apiKey?: string | null | undefined;
    baseUrl?: string | null | undefined;
    defaultModel?: string | null | undefined;
}>;
export declare const AgentConfigSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    provider: z.ZodOptional<z.ZodString>;
    model: z.ZodOptional<z.ZodString>;
    systemPrompt: z.ZodString;
    skills: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    maxIterations: z.ZodDefault<z.ZodNumber>;
    temperature: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    systemPrompt: string;
    maxIterations: number;
    provider?: string | undefined;
    model?: string | undefined;
    skills?: string[] | undefined;
    temperature?: number | undefined;
}, {
    name: string;
    description: string;
    systemPrompt: string;
    provider?: string | undefined;
    model?: string | undefined;
    skills?: string[] | undefined;
    maxIterations?: number | undefined;
    temperature?: number | undefined;
}>;
export declare const OmniAiConfigSchema: z.ZodObject<{
    version: z.ZodDefault<z.ZodString>;
    providers: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["anthropic", "openai", "copilot", "custom"]>;
        apiKey: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | undefined, string | null | undefined>;
        baseUrl: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | undefined, string | null | undefined>;
        defaultModel: z.ZodEffects<z.ZodOptional<z.ZodNullable<z.ZodString>>, string | undefined, string | null | undefined>;
        options: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "custom" | "anthropic" | "openai" | "copilot";
        options?: Record<string, unknown> | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        defaultModel?: string | undefined;
    }, {
        name: string;
        type: "custom" | "anthropic" | "openai" | "copilot";
        options?: Record<string, unknown> | undefined;
        apiKey?: string | null | undefined;
        baseUrl?: string | null | undefined;
        defaultModel?: string | null | undefined;
    }>, "many">;
    defaultProvider: z.ZodString;
    agentsDir: z.ZodDefault<z.ZodString>;
    agents: z.ZodOptional<z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        provider: z.ZodOptional<z.ZodString>;
        model: z.ZodOptional<z.ZodString>;
        systemPrompt: z.ZodString;
        skills: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        maxIterations: z.ZodDefault<z.ZodNumber>;
        temperature: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        systemPrompt: string;
        maxIterations: number;
        provider?: string | undefined;
        model?: string | undefined;
        skills?: string[] | undefined;
        temperature?: number | undefined;
    }, {
        name: string;
        description: string;
        systemPrompt: string;
        provider?: string | undefined;
        model?: string | undefined;
        skills?: string[] | undefined;
        maxIterations?: number | undefined;
        temperature?: number | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    version: string;
    providers: {
        name: string;
        type: "custom" | "anthropic" | "openai" | "copilot";
        options?: Record<string, unknown> | undefined;
        apiKey?: string | undefined;
        baseUrl?: string | undefined;
        defaultModel?: string | undefined;
    }[];
    defaultProvider: string;
    agentsDir: string;
    agents?: {
        name: string;
        description: string;
        systemPrompt: string;
        maxIterations: number;
        provider?: string | undefined;
        model?: string | undefined;
        skills?: string[] | undefined;
        temperature?: number | undefined;
    }[] | undefined;
}, {
    providers: {
        name: string;
        type: "custom" | "anthropic" | "openai" | "copilot";
        options?: Record<string, unknown> | undefined;
        apiKey?: string | null | undefined;
        baseUrl?: string | null | undefined;
        defaultModel?: string | null | undefined;
    }[];
    defaultProvider: string;
    version?: string | undefined;
    agents?: {
        name: string;
        description: string;
        systemPrompt: string;
        provider?: string | undefined;
        model?: string | undefined;
        skills?: string[] | undefined;
        maxIterations?: number | undefined;
        temperature?: number | undefined;
    }[] | undefined;
    agentsDir?: string | undefined;
}>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type OmniAiConfig = z.infer<typeof OmniAiConfigSchema>;
//# sourceMappingURL=schema.d.ts.map