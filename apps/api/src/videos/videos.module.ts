import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { VideosController } from "./videos.controller";
import { VideosService } from "./videos.service";

@Module({
  imports: [DatabaseModule],
  controllers: [VideosController],
  providers: [VideosService],
})
export class VideosModule {}
