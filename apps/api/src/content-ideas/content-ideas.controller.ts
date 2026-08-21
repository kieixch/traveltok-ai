import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { ContentIdeaStatus } from "@traveltok/database";
import { PaginationQueryDto } from "../common/dto/pagination.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../auth/types";
import { ContentIdeasService } from "./content-ideas.service";
import { ContentGenerationService } from "./content-generation.service";
import { CreateContentIdeaDto } from "./dto/create-content-idea.dto";
import { UpdateContentIdeaDto } from "./dto/update-content-idea.dto";
import { GenerateContentIdeasDto } from "./dto/generate-content-ideas.dto";
import { GenerateScriptDto } from "./dto/generate-script.dto";
import { GenerateCaptionDto } from "./dto/generate-caption.dto";

class ListIdeasQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsEnum(ContentIdeaStatus)
  status?: ContentIdeaStatus;
}

@Controller("content-ideas")
export class ContentIdeasController {
  constructor(
    private readonly contentIdeasService: ContentIdeasService,
    private readonly contentGenerationService: ContentGenerationService,
  ) {}

  @Post()
  create(@Body() dto: CreateContentIdeaDto) {
    return this.contentIdeasService.create(dto);
  }

  @Post("generate")
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateContentIdeasDto) {
    return this.contentGenerationService.generateIdeas(user.userId, dto);
  }

  @Post(":id/generate-script")
  generateScript(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: GenerateScriptDto,
  ) {
    return this.contentGenerationService.generateScript(user.userId, id, dto);
  }

  @Post(":id/generate-caption")
  generateCaption(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: GenerateCaptionDto,
  ) {
    return this.contentGenerationService.generateCaption(user.userId, id, dto);
  }

  @Get()
  list(@Query() query: ListIdeasQueryDto) {
    return this.contentIdeasService.list(query.page, query.pageSize, {
      projectId: query.projectId,
      status: query.status,
    });
  }

  @Get(":id")
  getById(@Param("id") id: string) {
    return this.contentIdeasService.getById(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateContentIdeaDto) {
    return this.contentIdeasService.update(id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.contentIdeasService.remove(id, user.userId);
  }
}
