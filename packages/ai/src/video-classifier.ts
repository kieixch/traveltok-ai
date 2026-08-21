import { VideoClassification, VideoClassificationInput } from "./types";

export interface VideoClassifier {
  classify(input: VideoClassificationInput): Promise<VideoClassification>;
}
