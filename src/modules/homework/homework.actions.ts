"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/modules/auth/auth.service";
import { can } from "@/common/permissions/permissions";
import { fail, ok, type ActionResult } from "@/common/filters/error";
import { createHomeworkSchema } from "@/modules/homework/homework.schema";
import {
  createHomework,
  getClassOwners,
  getHomeworkOwner,
  softDeleteHomework,
  updateHomework,
} from "@/modules/homework/homework.service";

export async function createHomeworkAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser(); //                                            1. session
  if (!can(user, "homework.create")) return fail("PERMISSION_DENIED"); //          2. quyền

  const parsed = createHomeworkSchema.safeParse(input); //                         3. validate
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  }

  // Chỉ giao được cho lớp mình dạy (Admin: mọi lớp).
  const classes = await getClassOwners(parsed.data.classIds);
  if (classes.length !== parsed.data.classIds.length)
    return fail("NOT_FOUND", "Có lớp không còn tồn tại.");
  if (
    !classes.every((c) =>
      can(user, "homework.create", { ownerId: c.teacherId }),
    )
  ) {
    return fail("PERMISSION_DENIED", "Bạn chỉ giao được bài cho lớp mình dạy.");
  }

  const homework = await createHomework(user.id, parsed.data); //                  4. ghi DB
  revalidatePath("/bai-tap");
  return ok(homework);
}

export async function updateHomeworkAction(
  homeworkId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser(); //                                            1. session
  const hw = await getHomeworkOwner(homeworkId);
  if (!hw) return fail("NOT_FOUND", "Bài tập không còn tồn tại.");
  if (!can(user, "homework.update", { ownerId: hw.teacherId }))
    return fail("PERMISSION_DENIED"); // 2. quyền

  const parsed = createHomeworkSchema.safeParse(input); //                         3. validate
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", parsed.error.issues[0]?.message);
  }

  const classes = await getClassOwners(parsed.data.classIds);
  if (classes.length !== parsed.data.classIds.length)
    return fail("NOT_FOUND", "Có lớp không còn tồn tại.");
  if (
    !classes.every((c) =>
      can(user, "homework.create", { ownerId: c.teacherId }),
    )
  ) {
    return fail("PERMISSION_DENIED", "Bạn chỉ giao được bài cho lớp mình dạy.");
  }

  await updateHomework(homeworkId, user.id, parsed.data); //                       4. ghi DB
  revalidatePath("/bai-tap");
  revalidatePath(`/bai-tap/${homeworkId}`);
  return ok({ id: homeworkId });
}

export async function deleteHomeworkAction(
  homeworkId: string,
): Promise<ActionResult<null>> {
  const user = await requireUser();
  const hw = await getHomeworkOwner(homeworkId);
  if (!hw) return fail("NOT_FOUND", "Bài tập không còn tồn tại.");
  if (!can(user, "homework.update", { ownerId: hw.teacherId }))
    return fail("PERMISSION_DENIED");

  await softDeleteHomework(homeworkId);
  revalidatePath("/bai-tap");
  return ok(null);
}
