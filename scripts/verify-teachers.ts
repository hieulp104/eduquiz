/**
 * Kiểm thử "Quản lý giáo viên" trên DB dev (cần đã chạy db:seed).
 * Chạy: npm run verify
 *
 * - SĐT phải đủ 10 chữ số (+84 → 0), email hợp lệ; thêm giáo viên ảo không cần tài khoản; trùng SĐT/email bị chặn
 * - Trùng SĐT/email với tài khoản giáo viên có sẵn → liên kết; học sinh thì không liên kết
 * - Phân quyền lớp cho giáo viên / nhóm → giáo viên (có tài khoản) thấy lớp, giao đề, xem kết quả; không sửa lớp
 * - Bỏ khỏi nhóm / xóa nhóm → mất quyền
 * Dữ liệu thử (giáo viên tạm, nhóm, phân quyền) bị xóa sau khi chạy.
 */
import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "@/shared/prisma/prisma.service";
import { can, type SessionUser } from "@/common/permissions/permissions";
import { contactSchema } from "@/modules/teachers/teachers.schema";
import { classVisibilityWhere } from "@/modules/classes/classes.service";
import { classSharedWith } from "@/modules/teachers/class-sharing.service";
import {
  addManagedTeacher,
  updateManagedTeacher,
  createTeacherGroup,
  deleteTeacherGroup,
  saveClassPermissions,
  setGroupMembers,
} from "@/modules/teachers/teachers.service";

const contact = (v: string) => contactSchema.parse(v);

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { username: "gv.lan" } });
  const student = await prisma.user.findUniqueOrThrow({ where: { username: "hs.an" } });
  const classroom = await prisma.classroom.findUniqueOrThrow({ where: { joinCode: "TOAN10" } });
  const temp = await prisma.user.create({
    data: {
      email: `verify-teacher-${Date.now()}@eduquiz.local`,
      phone: `09${Date.now().toString().slice(-8)}`,
      fullName: "GV tạm (verify)",
      passwordHash: "x",
      role: "TEACHER",
    },
  });
  const tempUser: SessionUser = { id: temp.id, email: temp.email, fullName: temp.fullName, role: temp.role };

  try {
    // 1. Kiểm tra SĐT / email
    for (const bad of ["091234567", "09123456789", "1912345678", "abc", "a@b"]) {
      assert.equal(contactSchema.safeParse(bad).success, false, `"${bad}" phải bị từ chối`);
    }
    assert.deepEqual(contact("+84 912.345.678"), { phone: "0912345678", email: null });
    assert.deepEqual(contact("GV@Truong.EDU.vn"), { phone: null, email: "gv@truong.edu.vn" });

    // 2. Giáo viên ảo + liên kết tài khoản
    assert.equal(await addManagedTeacher(owner.id, "GV ảo", contact("0911000111")), "added");
    assert.equal(await addManagedTeacher(owner.id, "Trùng", contact("0911000111")), "exists");
    const virtual = await prisma.managedTeacher.findFirstOrThrow({ where: { ownerId: owner.id, phone: "0911000111" } });
    assert.equal(virtual.teacherId, null, "Không có tài khoản → giáo viên ảo");
    if (student.phone) {
      assert.equal(await updateManagedTeacher(owner.id, virtual.id, "GV ảo", contact(student.phone)), "ok");
      const v2 = await prisma.managedTeacher.findUniqueOrThrow({ where: { id: virtual.id } });
      assert.equal(v2.teacherId, null, "Trùng SĐT học sinh thì không liên kết");
    }
    assert.equal(await addManagedTeacher(owner.id, "GV tạm", contact(temp.phone!.replace(/^0/, "+84"))), "added");
    const member = await prisma.managedTeacher.findFirstOrThrow({ where: { ownerId: owner.id, phone: temp.phone } });
    assert.equal(member.teacherId, temp.id, "Trùng SĐT tài khoản giáo viên → liên kết");
    assert.equal(await updateManagedTeacher(owner.id, virtual.id, "GV ảo", contact(temp.phone!)), "exists", "Sửa trùng SĐT bị chặn");

    const sees = async () =>
      Boolean(await prisma.classroom.findFirst({ where: { id: classroom.id, ...classVisibilityWhere(tempUser) }, select: { id: true } }));
    const ctx = async () => ({ ownerId: classroom.teacherId, sharedWith: (await classSharedWith([classroom.id])).get(classroom.id) });

    assert.equal(await sees(), false, "Chưa phân quyền thì không thấy lớp");
    assert.equal(can(tempUser, "assignment.create", await ctx()), false);

    // 3. Phân quyền trực tiếp (giáo viên ảo được phân quyền không ảnh hưởng ai)
    await saveClassPermissions({ kind: "teacher", id: virtual.id }, [classroom.id]);
    assert.deepEqual((await classSharedWith([classroom.id])).get(classroom.id), []);
    await saveClassPermissions({ kind: "teacher", id: member.id }, [classroom.id]);
    assert.equal(await sees(), true, "Được phân quyền thì thấy lớp");
    const c = await ctx();
    assert.ok(can(tempUser, "assignment.create", c) && can(tempUser, "assignment.result.view", c));
    assert.equal(can(tempUser, "class.update", { ownerId: classroom.teacherId }), false, "Không sửa được lớp");
    assert.equal(can({ ...tempUser, id: student.id, role: "STUDENT" }, "assignment.create", c), false);
    await saveClassPermissions({ kind: "teacher", id: member.id }, []);
    assert.equal(await sees(), false, "Bỏ phân quyền thì mất lớp");

    // 4. Qua nhóm
    const group = await createTeacherGroup(owner.id, "Nhóm verify");
    await saveClassPermissions({ kind: "group", id: group.id }, [classroom.id]);
    assert.equal(await sees(), false, "Chưa vào nhóm thì chưa thấy");
    assert.equal(await setGroupMembers(owner.id, group.id, [member.id]), true);
    assert.equal(await sees(), true, "Vào nhóm được phân quyền thì thấy lớp");
    assert.equal(await setGroupMembers(student.id, group.id, [member.id]), false, "Người khác không sửa được nhóm");
    await deleteTeacherGroup(owner.id, group.id);
    assert.equal(await sees(), false, "Xóa nhóm thì mất quyền");
    assert.equal(await prisma.classPermission.count({ where: { groupId: group.id } }), 0);
  } finally {
    await prisma.teacherGroup.deleteMany({ where: { ownerId: owner.id, name: "Nhóm verify" } });
    await prisma.managedTeacher.deleteMany({ where: { ownerId: owner.id, displayName: { in: ["GV ảo", "GV tạm"] } } });
    await prisma.user.delete({ where: { id: temp.id } }); // cascade: managed_teachers, phân quyền
  }
  console.log("✔ verify-teachers: SĐT 10 số / email, giáo viên ảo + liên kết tài khoản, phân quyền lớp trực tiếp + qua nhóm, thu hồi quyền");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
