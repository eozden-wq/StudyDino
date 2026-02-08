declare module "@xenova/transformers" {
    export function pipeline(
        task: string,
        model?: string
    ): Promise<import("@xenova/transformers").FeatureExtractionPipeline>
    export const env: {
        allowLocalModels?: boolean
        allowRemoteModels?: boolean
        useFS?: boolean
        useFSCache?: boolean
    }
}
