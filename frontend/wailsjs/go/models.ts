export namespace backend {
	
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
	
	

}

