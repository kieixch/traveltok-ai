import { Module } from "@nestjs/common";
import { DatabaseModule } from "@traveltok/database";
import { CreatorsController } from "./creators.controller";
import { CreatorsService } from "./creators.service";

@Module({
  imports: [DatabaseModule],
  controllers: [CreatorsController],
  providers: [CreatorsService],
})
export class CreatorsModule {}
