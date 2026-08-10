export namespace backend {
	
	export class EdgeSnapshot {
	    source: string;
	    target: string;
	
	    static createFrom(source: any = {}) {
	        return new EdgeSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.source = source["source"];
	        this.target = source["target"];
	    }
	}
	export class NodeSnapshot {
	    id: string;
	    type: string;
	    revision: number;
	    filename?: string;
	    markdown?: string;
	    imageRef?: string;
	    prompt?: string;
	
	    static createFrom(source: any = {}) {
	        return new NodeSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.revision = source["revision"];
	        this.filename = source["filename"];
	        this.markdown = source["markdown"];
	        this.imageRef = source["imageRef"];
	        this.prompt = source["prompt"];
	    }
	}
	export class CanvasSnapshot {
	    canvasId: string;
	    nodes: NodeSnapshot[];
	    edges: EdgeSnapshot[];
	
	    static createFrom(source: any = {}) {
	        return new CanvasSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.canvasId = source["canvasId"];
	        this.nodes = this.convertValues(source["nodes"], NodeSnapshot);
	        this.edges = this.convertValues(source["edges"], EdgeSnapshot);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ContextWarning {
	    kind: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ContextWarning(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.message = source["message"];
	    }
	}
	export class ChatRequest {
	    runId: string;
	    sessionId: string;
	    canvasId: string;
	    prompt: string;
	    targetNodeId?: string;
	    directContextNodeIds: string[];
	    contextWarning?: ContextWarning;
	    snapshot: CanvasSnapshot;
	
	    static createFrom(source: any = {}) {
	        return new ChatRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.runId = source["runId"];
	        this.sessionId = source["sessionId"];
	        this.canvasId = source["canvasId"];
	        this.prompt = source["prompt"];
	        this.targetNodeId = source["targetNodeId"];
	        this.directContextNodeIds = source["directContextNodeIds"];
	        this.contextWarning = this.convertValues(source["contextWarning"], ContextWarning);
	        this.snapshot = this.convertValues(source["snapshot"], CanvasSnapshot);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class ChatSessionMessage {
	    id: string;
	    role: string;
	    content: string;
	    createdAt: number;
	    runId?: string;
	    targetNodeId?: string;
	    targetRevision?: number;
	
	    static createFrom(source: any = {}) {
	        return new ChatSessionMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.role = source["role"];
	        this.content = source["content"];
	        this.createdAt = source["createdAt"];
	        this.runId = source["runId"];
	        this.targetNodeId = source["targetNodeId"];
	        this.targetRevision = source["targetRevision"];
	    }
	}
	export class ChatSession {
	    id: string;
	    title: string;
	    createdAt: number;
	    updatedAt: number;
	    messages: ChatSessionMessage[];
	
	    static createFrom(source: any = {}) {
	        return new ChatSession(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.title = source["title"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.messages = this.convertValues(source["messages"], ChatSessionMessage);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	export class XAIConfig {
	    apiKey: string;
	    model: string;
	
	    static createFrom(source: any = {}) {
	        return new XAIConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	        this.model = source["model"];
	    }
	}
	export class GoogleConfig {
	    model: string;
	    apiKey: string;
	
	    static createFrom(source: any = {}) {
	        return new GoogleConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	    }
	}
	export class OpenAIConfig {
	    baseURL: string;
	    model: string;
	    apiKey: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenAIConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseURL = source["baseURL"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	    }
	}
	export class OpenRouterConfig {
	    baseURL: string;
	    model: string;
	    apiKey: string;
	
	    static createFrom(source: any = {}) {
	        return new OpenRouterConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseURL = source["baseURL"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	    }
	}
	export class ImageGenConfig {
	    provider: string;
	    downloadPath: string;
	    openrouter?: OpenRouterConfig;
	    openai?: OpenAIConfig;
	    google?: GoogleConfig;
	    xai?: XAIConfig;
	    baseURL?: string;
	    model?: string;
	    apiKey?: string;
	
	    static createFrom(source: any = {}) {
	        return new ImageGenConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.downloadPath = source["downloadPath"];
	        this.openrouter = this.convertValues(source["openrouter"], OpenRouterConfig);
	        this.openai = this.convertValues(source["openai"], OpenAIConfig);
	        this.google = this.convertValues(source["google"], GoogleConfig);
	        this.xai = this.convertValues(source["xai"], XAIConfig);
	        this.baseURL = source["baseURL"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class GenerationConfig {
	    summaryMaxChars: number;
	
	    static createFrom(source: any = {}) {
	        return new GenerationConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.summaryMaxChars = source["summaryMaxChars"];
	    }
	}
	export class LLMConfig {
	    baseURL: string;
	    model: string;
	    apiKey: string;
	    systemPrompt: string;
	
	    static createFrom(source: any = {}) {
	        return new LLMConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.baseURL = source["baseURL"];
	        this.model = source["model"];
	        this.apiKey = source["apiKey"];
	        this.systemPrompt = source["systemPrompt"];
	    }
	}
	export class Config {
	    llm: LLMConfig;
	    generation: GenerationConfig;
	    imageGen: ImageGenConfig;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.llm = this.convertValues(source["llm"], LLMConfig);
	        this.generation = this.convertValues(source["generation"], GenerationConfig);
	        this.imageGen = this.convertValues(source["imageGen"], ImageGenConfig);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	
	
	
	
	
	export class ImportFileResult {
	    type: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportFileResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	    }
	}
	
	
	
	
	export class ToolApplicationResult {
	    toolCallId: string;
	    status: string;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ToolApplicationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.toolCallId = source["toolCallId"];
	        this.status = source["status"];
	        this.error = source["error"];
	    }
	}

}

