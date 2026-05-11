import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

const APPROVAL_RULE_OPERATORS = [
  'EQ',
  'NEQ',
  'CONTAINS',
  'NOT_CONTAINS',
  'GT',
  'GTE',
  'LT',
  'LTE',
  'IS_TRUE',
  'IS_FALSE'
] as const;

const APPROVAL_RULE_ACTIONS = ['APPROVE', 'PENDING', 'REJECT'] as const;

export class LinkApprovalRuleInputDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z][a-z0-9_]*$/)
  fieldKey!: string;

  @IsIn(APPROVAL_RULE_OPERATORS)
  operator!: (typeof APPROVAL_RULE_OPERATORS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(160)
  value?: string;

  @IsIn(APPROVAL_RULE_ACTIONS)
  action!: (typeof APPROVAL_RULE_ACTIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  order?: number;
}

export class UpdateLinkApprovalRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkApprovalRuleInputDto)
  rules!: LinkApprovalRuleInputDto[];
}
