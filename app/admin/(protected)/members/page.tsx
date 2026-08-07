import MembersClient from "@/components/admin/MembersClient";

export default function AdminMembersPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-800 mb-1">회원 관리</h1>
      <p className="text-xs text-gray-400 mb-6">가입 회원 조회 · 인플루언서/벤더 신청 승인 · 계정 상태 관리</p>
      <MembersClient />
    </div>
  );
}
