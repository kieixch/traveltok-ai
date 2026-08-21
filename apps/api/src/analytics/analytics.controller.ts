import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { TrendScoreService } from "./trend-score.service";
import { OpportunityService } from "./opportunity.service";
import {
  CreatorsQueryDto,
  EngagementQueryDto,
  HashtagsQueryDto,
  OpportunitiesQueryDto,
  ProjectScopeQueryDto,
  TrendScoreQueryDto,
} from "./dto/analytics-query.dto";

@Controller("analytics")
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly trendScoreService: TrendScoreService,
    private readonly opportunityService: OpportunityService,
  ) {}

  @Get("overview")
  overview(@Query() query: ProjectScopeQueryDto) {
    return this.analyticsService.overview(query.projectId);
  }

  @Get("engagement")
  engagement(@Query() query: EngagementQueryDto) {
    return this.analyticsService.engagement(
      query.projectId,
      query.from,
      query.to,
      query.bucket,
    );
  }

  @Get("creators")
  creators(@Query() query: CreatorsQueryDto) {
    return this.analyticsService.topCreators(
      query.projectId,
      query.sort,
      query.limit,
    );
  }

  @Get("hashtags")
  hashtags(@Query() query: HashtagsQueryDto) {
    return this.analyticsService.hashtagPerformance(query.projectId, query.limit);
  }

  @Get("trend-score")
  trendScore(@Query() query: TrendScoreQueryDto) {
    return this.trendScoreService.score({
      projectId: query.projectId,
      keyword: query.keyword,
      hashtag: query.hashtag,
      periodDays: query.periodDays,
    });
  }

  @Get("opportunities")
  opportunities(@Query() query: OpportunitiesQueryDto) {
    return this.opportunityService.findOpportunities(
      query.projectId,
      query.limit ?? 10,
    );
  }
}
