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
	    imageIncluded?: boolean;
	
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
	        this.imageIncluded = source["imageIncluded"];
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
	export class ChatHistoryMessage {
	    role: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new ChatHistoryMessage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	    }
	}
	export class ViewContextHintCluster {
	    clusterId: string;
	    label: string;
	    memberNodeIds: string[];
	
	    static createFrom(source: any = {}) {
	        return new ViewContextHintCluster(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.clusterId = source["clusterId"];
	        this.label = source["label"];
	        this.memberNodeIds = source["memberNodeIds"];
	    }
	}
	export class ViewContextHint {
	    viewId: string;
	    kind: string;
	    label: string;
	    clusters: ViewContextHintCluster[];
	
	    static createFrom(source: any = {}) {
	        return new ViewContextHint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.viewId = source["viewId"];
	        this.kind = source["kind"];
	        this.label = source["label"];
	        this.clusters = this.convertValues(source["clusters"], ViewContextHintCluster);
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
	    bodyAllowlistNodeIds?: string[];
	    workspaceId?: string;
	    runtimeGeneration?: string;
	    scopeEpoch?: number;
	    runEpoch?: number;
	    contextDigest?: string;
	    imageProvider?: string;
	    history?: ChatHistoryMessage[];
	    contextWarning?: ContextWarning;
	    viewHints?: ViewContextHint[];
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
	        this.bodyAllowlistNodeIds = source["bodyAllowlistNodeIds"];
	        this.workspaceId = source["workspaceId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.runEpoch = source["runEpoch"];
	        this.contextDigest = source["contextDigest"];
	        this.imageProvider = source["imageProvider"];
	        this.history = this.convertValues(source["history"], ChatHistoryMessage);
	        this.contextWarning = this.convertValues(source["contextWarning"], ContextWarning);
	        this.viewHints = this.convertValues(source["viewHints"], ViewContextHint);
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
	    isDefaultTitle: boolean;
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
	        this.isDefaultTitle = source["isDefaultTitle"];
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
	
	export class ClusterViewCluster {
	    label: string;
	    reason?: string;
	    nodeIds: string[];
	
	    static createFrom(source: any = {}) {
	        return new ClusterViewCluster(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.label = source["label"];
	        this.reason = source["reason"];
	        this.nodeIds = source["nodeIds"];
	    }
	}
	export class ClusterViewProposal {
	    viewLabel: string;
	    clusters: ClusterViewCluster[];
	    ungroupedNodeIds: string[];
	    sourceRevisions?: Record<string, number>;
	    imageInputModes?: Record<string, string>;
	    workspaceId?: string;
	    canvasId?: string;
	    runtimeGeneration?: string;
	    scopeEpoch?: number;
	    runEpoch?: number;
	
	    static createFrom(source: any = {}) {
	        return new ClusterViewProposal(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.viewLabel = source["viewLabel"];
	        this.clusters = this.convertValues(source["clusters"], ClusterViewCluster);
	        this.ungroupedNodeIds = source["ungroupedNodeIds"];
	        this.sourceRevisions = source["sourceRevisions"];
	        this.imageInputModes = source["imageInputModes"];
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.runEpoch = source["runEpoch"];
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
	export class WebSearchProviderKeys {
	    apiKey: string;
	
	    static createFrom(source: any = {}) {
	        return new WebSearchProviderKeys(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.apiKey = source["apiKey"];
	    }
	}
	export class WebSearchConfig {
	    provider: string;
	    ollama?: WebSearchProviderKeys;
	    kagi?: WebSearchProviderKeys;
	    brave?: WebSearchProviderKeys;
	
	    static createFrom(source: any = {}) {
	        return new WebSearchConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.provider = source["provider"];
	        this.ollama = this.convertValues(source["ollama"], WebSearchProviderKeys);
	        this.kagi = this.convertValues(source["kagi"], WebSearchProviderKeys);
	        this.brave = this.convertValues(source["brave"], WebSearchProviderKeys);
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
	    webSearch: WebSearchConfig;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.llm = this.convertValues(source["llm"], LLMConfig);
	        this.generation = this.convertValues(source["generation"], GenerationConfig);
	        this.imageGen = this.convertValues(source["imageGen"], ImageGenConfig);
	        this.webSearch = this.convertValues(source["webSearch"], WebSearchConfig);
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
	export class ContextClaim {
	    claimId: string;
	    kind: string;
	    text: string;
	    sourceIds: string[];
	    relatedNodeIds?: string[];
	
	    static createFrom(source: any = {}) {
	        return new ContextClaim(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.claimId = source["claimId"];
	        this.kind = source["kind"];
	        this.text = source["text"];
	        this.sourceIds = source["sourceIds"];
	        this.relatedNodeIds = source["relatedNodeIds"];
	    }
	}
	export class ContextPacketError {
	    code: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new ContextPacketError(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.code = source["code"];
	        this.message = source["message"];
	    }
	}
	export class SuggestedPacketRelation {
	    claimId?: string;
	    sourceId?: string;
	    targetNodeId: string;
	    kind: string;
	    reason?: string;
	
	    static createFrom(source: any = {}) {
	        return new SuggestedPacketRelation(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.claimId = source["claimId"];
	        this.sourceId = source["sourceId"];
	        this.targetNodeId = source["targetNodeId"];
	        this.kind = source["kind"];
	        this.reason = source["reason"];
	    }
	}
	export class ContextSource {
	    sourceId: string;
	    title: string;
	    url: string;
	    domain: string;
	    snippet: string;
	    retrievedAt: string;
	    clusterId?: string;
	
	    static createFrom(source: any = {}) {
	        return new ContextSource(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceId = source["sourceId"];
	        this.title = source["title"];
	        this.url = source["url"];
	        this.domain = source["domain"];
	        this.snippet = source["snippet"];
	        this.retrievedAt = source["retrievedAt"];
	        this.clusterId = source["clusterId"];
	    }
	}
	export class ContextPacket {
	    packetId: string;
	    query: string;
	    retrievedAt: string;
	    executor: string;
	    contextProvider: string;
	    status: string;
	    workspaceId: string;
	    canvasId: string;
	    runtimeGeneration: string;
	    scopeEpoch: number;
	    runId?: string;
	    runEpoch?: number;
	    sources: ContextSource[];
	    claims: ContextClaim[];
	    suggestedRelations: SuggestedPacketRelation[];
	    unresolved: string[];
	    followups: string[];
	    error?: ContextPacketError;
	
	    static createFrom(source: any = {}) {
	        return new ContextPacket(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.packetId = source["packetId"];
	        this.query = source["query"];
	        this.retrievedAt = source["retrievedAt"];
	        this.executor = source["executor"];
	        this.contextProvider = source["contextProvider"];
	        this.status = source["status"];
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.runId = source["runId"];
	        this.runEpoch = source["runEpoch"];
	        this.sources = this.convertValues(source["sources"], ContextSource);
	        this.claims = this.convertValues(source["claims"], ContextClaim);
	        this.suggestedRelations = this.convertValues(source["suggestedRelations"], SuggestedPacketRelation);
	        this.unresolved = source["unresolved"];
	        this.followups = source["followups"];
	        this.error = this.convertValues(source["error"], ContextPacketError);
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
	
	
	
	export class DirectSuggestClustersRequest {
	    workspaceId: string;
	    canvasId: string;
	    runtimeGeneration: string;
	    scopeEpoch: number;
	    contextDigest: string;
	    sourceNodeIds: string[];
	    sourceRevisions: Record<string, number>;
	    sourceNodes: NodeSnapshot[];
	
	    static createFrom(source: any = {}) {
	        return new DirectSuggestClustersRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.contextDigest = source["contextDigest"];
	        this.sourceNodeIds = source["sourceNodeIds"];
	        this.sourceRevisions = source["sourceRevisions"];
	        this.sourceNodes = this.convertValues(source["sourceNodes"], NodeSnapshot);
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
	export class DirectSuggestRelationsRequest {
	    workspaceId: string;
	    canvasId: string;
	    runtimeGeneration: string;
	    scopeEpoch: number;
	    contextDigest: string;
	    sourceNodeIds: string[];
	    sourceRevisions: Record<string, number>;
	    sourceNodes: NodeSnapshot[];
	
	    static createFrom(source: any = {}) {
	        return new DirectSuggestRelationsRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.contextDigest = source["contextDigest"];
	        this.sourceNodeIds = source["sourceNodeIds"];
	        this.sourceRevisions = source["sourceRevisions"];
	        this.sourceNodes = this.convertValues(source["sourceNodes"], NodeSnapshot);
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
	export class DirectTransformRequest {
	    operation: string;
	    sourceNodeIds: string[];
	    sourceRevisions: Record<string, number>;
	    workspaceId: string;
	    canvasId: string;
	    runtimeGeneration: string;
	    scopeEpoch: number;
	    contextDigest: string;
	    sourceNodes: NodeSnapshot[];
	
	    static createFrom(source: any = {}) {
	        return new DirectTransformRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.operation = source["operation"];
	        this.sourceNodeIds = source["sourceNodeIds"];
	        this.sourceRevisions = source["sourceRevisions"];
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.contextDigest = source["contextDigest"];
	        this.sourceNodes = this.convertValues(source["sourceNodes"], NodeSnapshot);
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
	    filename?: string;
	
	    static createFrom(source: any = {}) {
	        return new ImportFileResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.content = source["content"];
	        this.filename = source["filename"];
	    }
	}
	
	export class NextActionItem {
	    id: string;
	    kind: string;
	    role: string;
	    actionLevel: string;
	    route: string;
	    targetNodeIds: string[];
	    title: string;
	    reason: string;
	    expectedResult: string;
	    documentEffect: string;
	    control: string;
	    query?: string;
	    question?: string;
	
	    static createFrom(source: any = {}) {
	        return new NextActionItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.kind = source["kind"];
	        this.role = source["role"];
	        this.actionLevel = source["actionLevel"];
	        this.route = source["route"];
	        this.targetNodeIds = source["targetNodeIds"];
	        this.title = source["title"];
	        this.reason = source["reason"];
	        this.expectedResult = source["expectedResult"];
	        this.documentEffect = source["documentEffect"];
	        this.control = source["control"];
	        this.query = source["query"];
	        this.question = source["question"];
	    }
	}
	export class NextActionProposalSet {
	    requestId: string;
	    workspaceId: string;
	    canvasId: string;
	    runtimeGeneration: string;
	    scopeEpoch: number;
	    contextDigest: string;
	    sourceRevisions: Record<string, number>;
	    actions: NextActionItem[];
	
	    static createFrom(source: any = {}) {
	        return new NextActionProposalSet(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.contextDigest = source["contextDigest"];
	        this.sourceRevisions = source["sourceRevisions"];
	        this.actions = this.convertValues(source["actions"], NextActionItem);
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
	export class OrchestrationViewHint {
	    viewId: string;
	    kind: string;
	    label: string;
	
	    static createFrom(source: any = {}) {
	        return new OrchestrationViewHint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.viewId = source["viewId"];
	        this.kind = source["kind"];
	        this.label = source["label"];
	    }
	}
	export class OrchestrationProvenance {
	    origin: string;
	    query?: string;
	    url?: string;
	    domain?: string;
	    provider?: string;
	    model?: string;
	
	    static createFrom(source: any = {}) {
	        return new OrchestrationProvenance(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.origin = source["origin"];
	        this.query = source["query"];
	        this.url = source["url"];
	        this.domain = source["domain"];
	        this.provider = source["provider"];
	        this.model = source["model"];
	    }
	}
	export class OrchestrationRelationHint {
	    relationId: string;
	    sourceNodeId: string;
	    targetNodeId: string;
	    kind: string;
	    reason?: string;
	    provenance?: OrchestrationProvenance;
	
	    static createFrom(source: any = {}) {
	        return new OrchestrationRelationHint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.relationId = source["relationId"];
	        this.sourceNodeId = source["sourceNodeId"];
	        this.targetNodeId = source["targetNodeId"];
	        this.kind = source["kind"];
	        this.reason = source["reason"];
	        this.provenance = this.convertValues(source["provenance"], OrchestrationProvenance);
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
	export class OrchestrationNodeHint {
	    id: string;
	    type: string;
	    revision: number;
	    label: string;
	    summary?: string;
	    excerpt?: string;
	
	    static createFrom(source: any = {}) {
	        return new OrchestrationNodeHint(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.type = source["type"];
	        this.revision = source["revision"];
	        this.label = source["label"];
	        this.summary = source["summary"];
	        this.excerpt = source["excerpt"];
	    }
	}
	export class OrchestrationTurn {
	    role: string;
	    content: string;
	
	    static createFrom(source: any = {}) {
	        return new OrchestrationTurn(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.role = source["role"];
	        this.content = source["content"];
	    }
	}
	export class NextActionRequest {
	    requestId: string;
	    workspaceId: string;
	    canvasId: string;
	    runtimeGeneration: string;
	    scopeEpoch: number;
	    contextDigest: string;
	    focusText?: string;
	    dialogueHistory?: OrchestrationTurn[];
	    selectedNodeIds: string[];
	    nodeHints: OrchestrationNodeHint[];
	    relationHints?: OrchestrationRelationHint[];
	    viewHints?: OrchestrationViewHint[];
	    sourceRevisions: Record<string, number>;
	
	    static createFrom(source: any = {}) {
	        return new NextActionRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.requestId = source["requestId"];
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.contextDigest = source["contextDigest"];
	        this.focusText = source["focusText"];
	        this.dialogueHistory = this.convertValues(source["dialogueHistory"], OrchestrationTurn);
	        this.selectedNodeIds = source["selectedNodeIds"];
	        this.nodeHints = this.convertValues(source["nodeHints"], OrchestrationNodeHint);
	        this.relationHints = this.convertValues(source["relationHints"], OrchestrationRelationHint);
	        this.viewHints = this.convertValues(source["viewHints"], OrchestrationViewHint);
	        this.sourceRevisions = source["sourceRevisions"];
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
	
	
	
	
	
	
	
	
	export class RelationBatchItem {
	    sourceNodeId: string;
	    targetNodeId: string;
	    kind: string;
	    reason?: string;
	    direction?: string;
	
	    static createFrom(source: any = {}) {
	        return new RelationBatchItem(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceNodeId = source["sourceNodeId"];
	        this.targetNodeId = source["targetNodeId"];
	        this.kind = source["kind"];
	        this.reason = source["reason"];
	        this.direction = source["direction"];
	    }
	}
	export class TransformSourcePreview {
	    nodeId: string;
	    content: string;
	    revision: number;
	
	    static createFrom(source: any = {}) {
	        return new TransformSourcePreview(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodeId = source["nodeId"];
	        this.content = source["content"];
	        this.revision = source["revision"];
	    }
	}
	export class RelationBatchProposal {
	    relations: RelationBatchItem[];
	    sourceRevisions?: Record<string, number>;
	    imageInputModes?: Record<string, string>;
	    sources?: TransformSourcePreview[];
	    workspaceId?: string;
	    canvasId?: string;
	    runtimeGeneration?: string;
	    scopeEpoch?: number;
	    runEpoch?: number;
	
	    static createFrom(source: any = {}) {
	        return new RelationBatchProposal(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.relations = this.convertValues(source["relations"], RelationBatchItem);
	        this.sourceRevisions = source["sourceRevisions"];
	        this.imageInputModes = source["imageInputModes"];
	        this.sources = this.convertValues(source["sources"], TransformSourcePreview);
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.runEpoch = source["runEpoch"];
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
	
	export class ToolApplicationResult {
	    toolCallId: string;
	    status: string;
	    error?: string;
	    workspaceId?: string;
	    canvasId?: string;
	    runtimeGeneration?: string;
	    scopeEpoch?: number;
	    runEpoch?: number;
	
	    static createFrom(source: any = {}) {
	        return new ToolApplicationResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.toolCallId = source["toolCallId"];
	        this.status = source["status"];
	        this.error = source["error"];
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.runEpoch = source["runEpoch"];
	    }
	}
	export class TransformRelationProposal {
	    sourceNodeId: string;
	    targetNodeId?: string;
	    kind: string;
	    reason?: string;
	    direction?: string;
	
	    static createFrom(source: any = {}) {
	        return new TransformRelationProposal(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.sourceNodeId = source["sourceNodeId"];
	        this.targetNodeId = source["targetNodeId"];
	        this.kind = source["kind"];
	        this.reason = source["reason"];
	        this.direction = source["direction"];
	    }
	}
	export class TransformProposal {
	    operation: string;
	    sourceNodeIds: string[];
	    sourceRevisions: Record<string, number>;
	    content: string;
	    summary: string;
	    reason?: string;
	    suggestedRelations?: TransformRelationProposal[];
	    sources?: TransformSourcePreview[];
	    workspaceId?: string;
	    canvasId?: string;
	    runtimeGeneration?: string;
	    scopeEpoch?: number;
	
	    static createFrom(source: any = {}) {
	        return new TransformProposal(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.operation = source["operation"];
	        this.sourceNodeIds = source["sourceNodeIds"];
	        this.sourceRevisions = source["sourceRevisions"];
	        this.content = source["content"];
	        this.summary = source["summary"];
	        this.reason = source["reason"];
	        this.suggestedRelations = this.convertValues(source["suggestedRelations"], TransformRelationProposal);
	        this.sources = this.convertValues(source["sources"], TransformSourcePreview);
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
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
	
	
	
	
	
	
	export class WebSearchRequest {
	    query: string;
	    hintNodeIds?: string[];
	    hintSummaries?: string[];
	    knownUrls?: string[];
	    workspaceId: string;
	    canvasId: string;
	    runtimeGeneration: string;
	    scopeEpoch: number;
	    entryRoute: string;
	    maxSources?: number;
	    runId?: string;
	    runEpoch?: number;
	
	    static createFrom(source: any = {}) {
	        return new WebSearchRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.query = source["query"];
	        this.hintNodeIds = source["hintNodeIds"];
	        this.hintSummaries = source["hintSummaries"];
	        this.knownUrls = source["knownUrls"];
	        this.workspaceId = source["workspaceId"];
	        this.canvasId = source["canvasId"];
	        this.runtimeGeneration = source["runtimeGeneration"];
	        this.scopeEpoch = source["scopeEpoch"];
	        this.entryRoute = source["entryRoute"];
	        this.maxSources = source["maxSources"];
	        this.runId = source["runId"];
	        this.runEpoch = source["runEpoch"];
	    }
	}

}

