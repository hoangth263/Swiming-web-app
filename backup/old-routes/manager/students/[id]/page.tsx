"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ArrowLeft,
  Mail,
  Calendar,
  User,
  Tag,
  Key,
  Building,
  Award,
  Book,
  GraduationCap,
  Phone,
  CreditCard,
  Users,
  Save,
  CheckIcon,
  Upload,
} from "lucide-react";
import { getSelectedTenant } from "@/utils/tenant-utils";
import { getAuthToken } from "@/api/auth-utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getMediaDetails } from "@/api/media-api";
import {
  fetchStudentDetail,
  fetchStudents,
  updateStudent,
} from "@/api/students-api";
import { getTenantInfo } from "@/api/tenant-api";
import { uploadMedia } from "@/api/media-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";

export default function StudentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;
  const [detail, setDetail] = useState<any>(null);
  const [parentInfo, setParentInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string>("/placeholder.svg");
  const [tenantName, setTenantName] = useState<string>("");
  const [isFetchingTenant, setIsFetchingTenant] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New state to track avatar upload for form submission
  const [uploadedAvatarId, setUploadedAvatarId] = useState<string | null>(null);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);

  // Form state for student edit
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    address: "",
    birthday: "",
    is_active: true,
    password: "", // Optional for update
  });

  // Fetch tenant name function
  const fetchTenantName = async (tenantId: string) => {
    if (!tenantId) return;
    setIsFetchingTenant(true);
    try {
      const { title } = await getTenantInfo(tenantId);
      setTenantName(title);
    } catch (err) {
      console.error("Error fetching tenant name:", err);
    } finally {
      setIsFetchingTenant(false);
    }
  };

  useEffect(() => {
    async function fetchDetail() {
      setLoading(true);
      setError(null);
      setDetail(null);
      setParentInfo(null);
      try {
        const tenantId = getSelectedTenant();
        if (!tenantId) throw new Error("Không tìm thấy tenant");
        const token = getAuthToken();
        if (!token) throw new Error("Không có thông tin xác thực");

        const detailData = await fetchStudentDetail({
          studentId,
          tenantId,
          token,
        });
        setDetail(detailData);

        // Fetch avatar if available - handle new featured_image structure
        // Handle featured_image structure - Both formats are valid:
        // - Array format: featured_image: [{ path: ["url"] }]
        // - Object format: featured_image: { path: "url" }
        if (detailData?.user?.featured_image) {
          if (
            Array.isArray(detailData.user.featured_image) &&
            detailData.user.featured_image.length > 0
          ) {
            // Array format: [{ path: ["url"] }]
            const firstImage = detailData.user.featured_image[0];
            if (firstImage?.path) {
              if (
                Array.isArray(firstImage.path) &&
                firstImage.path.length > 0
              ) {
                setAvatarUrl(firstImage.path[0]);
              } else if (typeof firstImage.path === "string") {
                setAvatarUrl(firstImage.path);
              }
            }
          } else if (
            typeof detailData.user.featured_image === "object" &&
            detailData.user.featured_image.path
          ) {
            // Object format: { path: "url" } or { path: ["url"] }
            if (Array.isArray(detailData.user.featured_image.path)) {
              setAvatarUrl(detailData.user.featured_image.path[0]);
            } else if (
              typeof detailData.user.featured_image.path === "string"
            ) {
              setAvatarUrl(detailData.user.featured_image.path);
            }
          } else if (typeof detailData.user.featured_image === "string") {
            // Fallback: if it's just a media ID string, try to get media details
            try {
              const mediaPath = await getMediaDetails(
                detailData.user.featured_image
              );
              if (mediaPath) {
                setAvatarUrl(mediaPath);
              }
            } catch (error) {
              console.error("Error fetching media details:", error);
            }
          }
        }

        // Check if student has a parent and fetch parent information
        if (
          detailData?.user?.parent_id &&
          detailData.user.parent_id.length > 0
        ) {
          try {
            // Fetch parent details based on parent_id
            const parentId = detailData.user.parent_id[0]; // Assuming parent_id is an array and we use the first one

            // Using fetchStudents to get all members, then filter by parent ID
            const allMembers = await fetchStudents({
              tenantId,
              token,
              role: "member",
            });

            // Find parent from members based on parent_id
            const parentData = allMembers.find(
              (member: any) => member.user?._id === parentId
            );

            if (parentData) {
              setParentInfo(parentData);
            }
          } catch (parentErr) {
            console.error("Lỗi khi tải thông tin phụ huynh:", parentErr);
          }
        }
      } catch (e: any) {
        setError(e.message || "Lỗi khi lấy thông tin học viên");
      }
      setLoading(false);
    }
    if (studentId) fetchDetail();
  }, [studentId]);

  // Effect to fetch tenant name when detail data is available
  useEffect(() => {
    if (detail?.tenant_id) {
      fetchTenantName(detail.tenant_id);
    }
  }, [detail?.tenant_id]);

  // Populate form data when student detail is loaded
  useEffect(() => {
    if (detail?.user) {
      setFormData({
        username: detail.user.username || "",
        email: detail.user.email || "",
        phone: detail.user.phone || "",
        address: detail.user.address || "",
        birthday: detail.user.birthday
          ? new Date(detail.user.birthday).toISOString().split("T")[0]
          : "",
        is_active: detail.user.is_active || false,
        password: "",
      });
    }
  }, [detail]);

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({
        ...formData,
        [name]: (e.target as HTMLInputElement).checked,
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Handle the switch toggle for active status
  const handleSwitchChange = (checked: boolean) => {
    setFormData({
      ...formData,
      is_active: checked,
    });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Prepare update data - only include fields that have values
    const updateData = Object.entries(formData).reduce((acc, [key, value]) => {
      // Only include the password if it's not empty
      if (key === "password" && value === "") return acc;
      // Otherwise include the field if it has a value
      if (value !== undefined && value !== null && value !== "") {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    // Add role_front field to match API specification
    updateData.role_front = ["member"];

    // Add parent_id as string if it exists in the original data
    if (detail.user?.parent_id && detail.user.parent_id.length > 0) {
      updateData.parent_id = detail.user.parent_id[0]; // Send first parent ID as string
    }

    // Add featured_image only if we have a new uploaded avatar
    if (uploadedAvatarId) {
      updateData.featured_image = [uploadedAvatarId]; // Send as array of strings
    }

    try {
      const tenantId = getSelectedTenant();
      if (!tenantId) throw new Error("Không tìm thấy tenant");
      const token = getAuthToken();
      if (!token) throw new Error("Không có thông tin xác thực");

      // Call the update API
      await updateStudent({
        studentId,
        data: updateData,
        tenantId,
        token,
      });

      // Close modal and refresh data
      setIsEditModalOpen(false);
      toast({
        title: "Cập nhật thành công",
        description: "Thông tin học viên đã được cập nhật",
        variant: "default",
      });

      // Clear the uploaded avatar ID after successful update
      setUploadedAvatarId(null);

      // Refresh student data
      fetchDetail();
    } catch (error: any) {
      toast({
        title: "Lỗi cập nhật thông tin",
        description: error.message || "Không thể cập nhật thông tin học viên",
        variant: "destructive",
      });
      console.error("Error updating student:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Avatar upload handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) {
      return;
    }

    const tenantId = getSelectedTenant();
    const token = getAuthToken();
    if (!tenantId || !token) {
      toast({
        title: "Lỗi xác thực",
        description: "Không thể xác thực thông tin người dùng",
        variant: "destructive",
      });
      return;
    }

    try {
      const file = e.target.files[0];
      setIsAvatarUploading(true);

      // Upload the media file
      const uploadResponse = await uploadMedia({
        file,
        title: `Avatar for ${detail?.user?.username || "student"}`,
        alt: `Avatar for ${detail?.user?.username || "student"}`,
        tenantId,
        token,
      });

      if (!uploadResponse || !uploadResponse.data || !uploadResponse.data._id) {
        throw new Error("Không nhận được ID media từ server");
      }

      const mediaId = uploadResponse.data._id;

      // Update the student's data in our state first
      if (detail && detail.user) {
        const updatedDetail = {
          ...detail,
          user: {
            ...detail.user,
            featured_image: [mediaId],
          },
        };
        setDetail(updatedDetail);
      }

      // Update the avatar URL immediately to show the change
      const mediaPath = await getMediaDetails(mediaId);
      if (mediaPath) {
        setAvatarUrl(mediaPath);
      }

      setUploadedAvatarId(mediaId); // Set the uploaded avatar ID for form submission

      toast({
        title: "Tải ảnh lên thành công",
        description: "Ảnh đại diện đã được cập nhật. Nhớ lưu thay đổi!",
        variant: "default",
        className:
          "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Tải ảnh lên thất bại",
        description: "Đã xảy ra lỗi khi tải ảnh đại diện",
        variant: "destructive",
      });
    } finally {
      setIsAvatarUploading(false);
    }
  };

  // Function to refresh student data
  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const tenantId = getSelectedTenant();
      if (!tenantId) throw new Error("Không tìm thấy tenant");
      const token = getAuthToken();
      if (!token) throw new Error("Không có thông tin xác thực");

      const detailData = await fetchStudentDetail({
        studentId,
        tenantId,
        token,
      });
      setDetail(detailData);

      // Fetch avatar if available - handle new featured_image structure
      // Handle featured_image structure - Both formats are valid:
      // - Array format: featured_image: [{ path: ["url"] }]
      // - Object format: featured_image: { path: "url" }
      if (detailData?.user?.featured_image) {
        if (
          Array.isArray(detailData.user.featured_image) &&
          detailData.user.featured_image.length > 0
        ) {
          // Array format: [{ path: ["url"] }]
          const firstImage = detailData.user.featured_image[0];
          if (firstImage?.path) {
            if (Array.isArray(firstImage.path) && firstImage.path.length > 0) {
              setAvatarUrl(firstImage.path[0]);
            } else if (typeof firstImage.path === "string") {
              setAvatarUrl(firstImage.path);
            }
          }
        } else if (
          typeof detailData.user.featured_image === "object" &&
          detailData.user.featured_image.path
        ) {
          // Object format: { path: "url" } or { path: ["url"] }
          if (Array.isArray(detailData.user.featured_image.path)) {
            setAvatarUrl(detailData.user.featured_image.path[0]);
          } else if (typeof detailData.user.featured_image.path === "string") {
            setAvatarUrl(detailData.user.featured_image.path);
          }
        } else if (typeof detailData.user.featured_image === "string") {
          // Fallback: if it's just a media ID string, try to get media details
          try {
            const mediaPath = await getMediaDetails(
              detailData.user.featured_image
            );
            if (mediaPath) {
              setAvatarUrl(mediaPath);
            }
          } catch (error) {
            console.error("Error fetching media details:", error);
          }
        }
      }

      // Check if student has a parent and fetch parent information
      if (detailData?.user?.parent_id && detailData.user.parent_id.length > 0) {
        try {
          // Fetch parent details based on parent_id
          const parentId = detailData.user.parent_id[0]; // Assuming parent_id is an array and we use the first one

          // Using fetchStudents to get all members, then filter by parent ID
          const allMembers = await fetchStudents({
            tenantId,
            token,
            role: "member",
          });

          // Find parent from members based on parent_id
          const parentData = allMembers.find(
            (member: any) => member.user?._id === parentId
          );

          if (parentData) {
            setParentInfo(parentData);
          }
        } catch (parentErr) {
          console.error("Lỗi khi tải thông tin phụ huynh:", parentErr);
        }
      }
    } catch (e: any) {
      setError(e.message || "Lỗi khi lấy thông tin học viên");
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className='flex flex-col items-center justify-center py-16'>
        <Loader2 className='h-10 w-10 animate-spin text-muted-foreground mb-4' />
        <div>Đang tải chi tiết học viên...</div>
      </div>
    );
  }

  if (error) {
    return <div className='text-red-500 p-8'>{error}</div>;
  }

  if (!detail) {
    return <div className='p-8'>Không tìm thấy học viên.</div>;
  }

  return (
    <div className='container mx-auto py-8 px-4'>
      <div className='mb-8'>
        <Link
          href='/dashboard/manager/students'
          className='inline-flex items-center text-sm font-medium text-primary hover:text-primary/90 transition-colors'
        >
          <ArrowLeft className='mr-1.5 h-4 w-4' /> Quay về danh sách học viên
        </Link>
        <h1 className='text-3xl font-bold mt-4'>Hồ sơ học viên</h1>
        <p className='text-muted-foreground mt-1'>
          Thông tin chi tiết và lịch sử học tập của học viên
        </p>
      </div>

      {/* Student Edit Modal */}
      <Dialog
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
      >
        <DialogContent className='sm:max-w-[600px]'>
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa thông tin học viên</DialogTitle>
              <DialogDescription>
                Cập nhật thông tin cho học viên {detail.user?.username}. Để
                trống mật khẩu nếu không muốn thay đổi.
              </DialogDescription>
            </DialogHeader>
            <div className='grid gap-6 py-4'>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label
                  htmlFor='username'
                  className='text-right'
                >
                  Tên đăng nhập
                </Label>
                <Input
                  id='username'
                  name='username'
                  value={formData.username}
                  onChange={handleInputChange}
                  className='col-span-3'
                  required
                />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label
                  htmlFor='email'
                  className='text-right'
                >
                  Email
                </Label>
                <Input
                  id='email'
                  name='email'
                  value={formData.email}
                  onChange={handleInputChange}
                  className='col-span-3'
                  required
                />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label
                  htmlFor='phone'
                  className='text-right'
                >
                  Số điện thoại
                </Label>
                <Input
                  id='phone'
                  name='phone'
                  value={formData.phone}
                  onChange={handleInputChange}
                  className='col-span-3'
                />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label
                  htmlFor='address'
                  className='text-right'
                >
                  Địa chỉ
                </Label>
                <Input
                  id='address'
                  name='address'
                  value={formData.address}
                  onChange={handleInputChange}
                  className='col-span-3'
                />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label
                  htmlFor='birthday'
                  className='text-right'
                >
                  Ngày sinh
                </Label>
                <Input
                  id='birthday'
                  name='birthday'
                  type='date'
                  value={formData.birthday}
                  onChange={handleInputChange}
                  className='col-span-3'
                />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label
                  htmlFor='password'
                  className='text-right'
                >
                  Mật khẩu mới
                </Label>
                <Input
                  id='password'
                  name='password'
                  type='password'
                  value={formData.password}
                  onChange={handleInputChange}
                  className='col-span-3'
                  placeholder='Để trống nếu không thay đổi'
                />
              </div>
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label
                  htmlFor='is_active'
                  className='text-right'
                >
                  Trạng thái hoạt động
                </Label>
                <div className='flex items-center space-x-2 col-span-3'>
                  <Switch
                    id='is_active'
                    name='is_active'
                    checked={formData.is_active}
                    onCheckedChange={handleSwitchChange}
                  />
                  <Label
                    htmlFor='is_active'
                    className='cursor-pointer'
                  >
                    {formData.is_active ? "Đang hoạt động" : "Không hoạt động"}
                  </Label>
                </div>
              </div>

              {/* Avatar Upload Field */}
              <div className='grid grid-cols-4 items-center gap-4'>
                <Label className='text-right'>Ảnh đại diện</Label>
                <div className='flex items-center gap-4 col-span-3'>
                  <Avatar className='h-16 w-16 border-4 border-background shadow-md'>
                    <AvatarImage
                      src={avatarUrl}
                      alt={detail.user?.username || "Student"}
                      className='object-cover'
                    />
                    <AvatarFallback className='text-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white'>
                      {detail.user?.username?.charAt(0) || "S"}
                    </AvatarFallback>
                  </Avatar>
                  <label className='flex-1'>
                    <Button
                      variant='outline'
                      className='w-full'
                      type='button'
                      asChild
                      disabled={isAvatarUploading}
                    >
                      <span className='flex items-center justify-center'>
                        {isAvatarUploading ? (
                          <>
                            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                            Đang tải...
                          </>
                        ) : (
                          <>
                            <Upload className='mr-2 h-4 w-4' /> Tải ảnh lên
                          </>
                        )}
                      </span>
                    </Button>
                    <input
                      type='file'
                      accept='image/*'
                      onChange={(e) => handleAvatarUpload(e)}
                      className='hidden'
                      disabled={isAvatarUploading}
                    />
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type='button'
                variant='outline'
                onClick={() => setIsEditModalOpen(false)}
                disabled={isSubmitting}
              >
                Hủy
              </Button>
              <Button
                type='submit'
                disabled={isSubmitting}
                className='bg-blue-600 hover:bg-blue-700'
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Save className='mr-2 h-4 w-4' />
                    Lưu thay đổi
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
        {/* Profile Section */}
        <Card className='md:col-span-1 overflow-hidden border-0 shadow-md'>
          <div className='bg-gradient-to-r from-blue-500 to-cyan-400 h-24 dark:from-blue-600 dark:to-cyan-500'></div>
          <CardContent className='flex flex-col items-center text-center pt-0 relative pb-6'>
            <Avatar className='h-32 w-32 border-4 border-background shadow-md absolute -top-16'>
              <AvatarImage
                src={avatarUrl}
                alt={detail.user?.username || "Student"}
                className='object-cover'
              />
              <AvatarFallback className='text-2xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white'>
                {detail.user?.username?.charAt(0) || "S"}
              </AvatarFallback>
            </Avatar>
            <div className='mt-16 w-full'>
              <h2 className='text-2xl font-bold mt-2'>
                {detail.user?.username}
              </h2>
              <p className='text-muted-foreground mb-3 italic'>
                {detail.user?.email}
              </p>

              {detail.user?.role_front?.length > 0 && (
                <div className='flex flex-wrap gap-2 justify-center mb-4'>
                  {detail.user.role_front.map((role: string, index: number) => (
                    <Badge
                      key={index}
                      variant='outline'
                      className='py-1.5 px-3 bg-blue-50/90 border-blue-200 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800'
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              )}

              <div className='mt-3'>
                <Badge
                  variant={detail.user?.is_active ? "default" : "destructive"}
                  className={`py-1.5 px-4 ${
                    detail.user?.is_active
                      ? "bg-green-100 hover:bg-green-200 text-green-800 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800"
                      : "bg-red-100 hover:bg-red-200 text-red-800 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800"
                  }`}
                >
                  {detail.user?.is_active ? "Hoạt động" : "Không hoạt động"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Section */}
        <Card className='md:col-span-2 border-0 shadow-md'>
          <CardHeader className='bg-gradient-to-r from-muted/50 to-muted border-b'>
            <CardTitle className='text-xl flex items-center gap-2'>
              <User className='h-5 w-5 text-blue-600 dark:text-blue-400' /> Chi
              tiết học viên
            </CardTitle>
          </CardHeader>
          <CardContent className='space-y-8 pt-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
              <div className='space-y-5 bg-muted/50 p-5 rounded-lg'>
                <h3 className='text-md font-semibold text-blue-800 dark:text-blue-300 mb-4 border-b pb-2'>
                  Thông tin cá nhân
                </h3>
                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <User className='h-5 w-5 mt-0.5 text-blue-500 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Tên đăng nhập
                    </p>
                    <p className='font-medium mt-0.5'>
                      {detail.user?.username || "-"}
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <Mail className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Email
                    </p>
                    <p className='font-medium mt-0.5'>
                      {detail.user?.email || "-"}
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <Calendar className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Ngày đăng ký
                    </p>
                    <p className='font-medium mt-0.5'>
                      {detail.user?.created_at
                        ? new Date(detail.user.created_at).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <Calendar className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Ngày sinh
                    </p>
                    <p className='font-medium mt-0.5'>
                      {detail.user?.birthday
                        ? new Date(detail.user.birthday).toLocaleDateString(
                            "vi-VN"
                          )
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <Phone className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Số điện thoại
                    </p>
                    <p className='font-medium mt-0.5'>
                      {detail.user?.phone || "-"}
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <Building className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Địa chỉ
                    </p>
                    <p className='font-medium mt-0.5'>
                      {detail.user?.address || "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className='space-y-5 bg-muted/50 p-5 rounded-lg'>
                <h3 className='text-md font-semibold text-blue-800 dark:text-blue-300 mb-4 border-b pb-2'>
                  Thông tin học tập
                </h3>
                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <GraduationCap className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Loại tài khoản
                    </p>
                    <p className='font-medium mt-0.5'>
                      {detail.user?.role_front?.join(", ") || "-"}
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <Building className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Chi nhánh
                    </p>
                    <p className='font-medium mt-0.5'>
                      {isFetchingTenant ? (
                        <span className='inline-flex items-center'>
                          <Loader2 className='h-3 w-3 mr-2 animate-spin' />
                          Đang tải...
                        </span>
                      ) : (
                        tenantName || "Chi nhánh không xác định"
                      )}
                    </p>
                  </div>
                </div>

                <div className='flex items-start gap-3 group transition-all hover:bg-background hover:shadow-sm p-2 rounded-md'>
                  <CreditCard className='h-5 w-5 mt-0.5 text-blue-500 dark:text-blue-400 flex-shrink-0 group-hover:scale-110 transition-transform' />
                  <div>
                    <p className='text-sm font-medium text-muted-foreground'>
                      Trạng thái thanh toán
                    </p>
                    <p className='font-medium mt-0.5'>Đã thanh toán</p>
                  </div>
                </div>
              </div>
            </div>

            <div className='space-y-6'>
              <h3 className='text-lg font-semibold text-blue-800 dark:text-blue-300 flex items-center mb-4 border-b pb-2'>
                <Award className='h-5 w-5 mr-2 text-blue-600 dark:text-blue-400' />{" "}
                Khóa học đã đăng ký
              </h3>
              <div className='bg-blue-50 border border-blue-100 rounded-md p-6 text-center dark:bg-blue-950/30 dark:border-blue-800'>
                <div className='bg-background rounded-full w-16 h-16 mx-auto mb-3 flex items-center justify-center shadow-sm'>
                  <Book className='h-8 w-8 text-blue-400' />
                </div>
                <p className='text-blue-900 dark:text-blue-200 font-medium mb-1'>
                  Chưa có khóa học nào được đăng ký
                </p>
                <p className='text-blue-700/70 dark:text-blue-300/70 text-sm mb-4'>
                  Học viên chưa tham gia khóa học nào
                </p>
                <Button
                  size='sm'
                  variant='outline'
                  className='bg-background hover:bg-blue-50 dark:hover:bg-blue-900/40 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                >
                  <span className='mr-1'>+</span> Đăng ký khóa học mới
                </Button>
              </div>
            </div>

            {/* Parent Information Section - Show only when parent_id exists */}
            {parentInfo && (
              <div className='mt-6'>
                <h3 className='text-lg font-semibold text-blue-800 dark:text-blue-300 flex items-center mb-4 border-b pb-2'>
                  <Users className='h-5 w-5 mr-2 text-blue-600 dark:text-blue-400' />{" "}
                  Thông tin phụ huynh
                </h3>
                <div className='bg-amber-50 border border-amber-100 rounded-md p-5 dark:bg-amber-950/30 dark:border-amber-900/60'>
                  <div className='flex items-center gap-4 mb-4'>
                    <Avatar className='h-14 w-14 border-2 border-background shadow-sm'>
                      <AvatarFallback className='bg-gradient-to-br from-amber-500 to-orange-400 text-white'>
                        {parentInfo.user?.username?.charAt(0) || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className='font-medium text-lg'>
                        {parentInfo.user?.username}
                      </p>
                      <p className='text-sm text-amber-700/80 dark:text-amber-400/80'>
                        {parentInfo.user?.email}
                      </p>
                    </div>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 bg-background p-3 rounded-md'>
                    {parentInfo.user?.phone && (
                      <div className='flex items-center gap-2'>
                        <Phone className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                        <span>{parentInfo.user.phone}</span>
                      </div>
                    )}

                    {parentInfo.user?.address && (
                      <div className='flex items-center gap-2'>
                        <Building className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                        <span>{parentInfo.user.address}</span>
                      </div>
                    )}
                  </div>

                  <div className='mt-4 flex justify-end'>
                    <Link
                      href={`/dashboard/manager/students/${parentInfo.user?._id}`}
                    >
                      <Button
                        variant='outline'
                        size='sm'
                        className='bg-background hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      >
                        <User className='mr-2 h-4 w-4' />
                        Xem hồ sơ phụ huynh
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <Separator className='my-6' />

            <div className='flex justify-end gap-4'>
              <Button
                variant='outline'
                className='border-blue-200 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-800 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 px-6'
                onClick={() => setIsEditModalOpen(true)}
              >
                <User className='mr-2 h-4 w-4' /> Chỉnh sửa
              </Button>
              <Button className='bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 shadow-sm px-6'>
                <Calendar className='mr-2 h-4 w-4' /> Xem lịch học
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
