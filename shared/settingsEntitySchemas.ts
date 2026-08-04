import { z } from 'zod';

const name = z.string().trim().min(1).max(50);
const idList = z.array(z.string().trim().min(1)).max(500).refine(items => new Set(items).size === items.length);
const targetHours = z.number().finite().min(0).max(999).nullable();
const weeklyHoursTarget = z.number().finite().min(0).max(168).nullable();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const ClassCreateSchema = z.object({
    name,
    auto_allocate: z.union([z.literal(0), z.literal(1)]).optional(),
    color: color.optional(),
}).strict();

export const ClassUpdateSchema = ClassCreateSchema.partial().extend({
    display_order: z.number().int().positive().optional(),
}).refine(body => Object.keys(body).length > 0);

export const RoleCreateSchema = z.object({
    name,
    targetHours: targetHours.optional(),
    weeklyHoursTarget: weeklyHoursTarget.optional(),
    patternIds: idList.optional(),
}).strict();

export const RoleUpdateSchema = RoleCreateSchema.partial().refine(body => Object.keys(body).length > 0);

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dayFlag = z.union([z.literal(0), z.literal(1)]);
const timePatternFields = {
    name,
    startTime: time,
    endTime: time,
    roleIds: idList.optional(),
    sun: dayFlag.optional(), mon: dayFlag.optional(), tue: dayFlag.optional(), wed: dayFlag.optional(),
    thu: dayFlag.optional(), fri: dayFlag.optional(), sat: dayFlag.optional(), holiday: dayFlag.optional(),
};

export const TimePatternCreateSchema = z.object(timePatternFields).strict();
export const TimePatternUpdateSchema = TimePatternCreateSchema.partial().refine(body => Object.keys(body).length > 0);
