import {
    BadRequestException,
    Injectable,
    type PipeTransform,
} from "@nestjs/common";
import { z } from "zod";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
    constructor(private readonly schema: z.ZodType) {}

    transform(value: unknown) {
        const result = this.schema.safeParse(value);
        if (!result.success) {
            throw new BadRequestException({
                message: "Validation failed",
                errors: z.treeifyError(result.error),
            });
        }
        return result.data;
    }
}
