"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Filter,
  Download,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "../../../../hooks/use-auth";
import {
  fetchOrders,
  formatPrice,
  getStatusName,
  getStatusClass,
  getOrderUserName,
  getOrderUserContact,
  updateOrderStatus,
  Order,
} from "../../../../api/orders-api";
import { fetchCourseById } from "../../../../api/courses-api";

interface CourseInfo {
  title: string;
  price?: number;
}

export default function TransactionsPage() {
  const { toast } = useToast();
  const { token, tenantId, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [courseFilter, setCourseFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseInfo, setCourseInfo] = useState<Record<string, CourseInfo>>({});
  const [loadingCourses, setLoadingCourses] = useState<Record<string, boolean>>(
    {}
  );

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [limit, setLimit] = useState(10);

  // Status update states
  const [statusUpdateDialogOpen, setStatusUpdateDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch orders from API
  useEffect(() => {
    // Wait for auth to complete
    if (authLoading) return;

    async function getOrders() {
      console.log("[Transactions] Auth state:", { token, tenantId });
      if (!token || !tenantId) {
        console.error(
          "[Transactions] Missing token or tenantId - cannot fetch orders"
        );
        setError("Thiếu thông tin xác thực. Vui lòng đăng nhập lại.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        console.log("[Transactions] Fetching orders with:", {
          tenantId,
          tokenLength: token?.length,
          currentPage,
          limit,
        });

        const ordersData = await fetchOrders({
          tenantId,
          token,
          page: currentPage,
          limit,
        });

        console.log("[Transactions] Orders data received:", {
          count: ordersData?.orders?.length || 0,
          total: ordersData?.total || 0,
        });

        if (!ordersData || !ordersData.orders) {
          throw new Error("API returned invalid data format");
        }

        setOrders(ordersData.orders);
        setTotalOrders(ordersData.total);

        // Prepare for course fetching
        const courseIds = [
          ...new Set(ordersData.orders.map((order) => order.course)),
        ];
        console.log("[Transactions] Found course IDs:", courseIds);

        const initialLoadingState = courseIds.reduce((acc, id) => {
          acc[id] = true;
          return acc;
        }, {} as Record<string, boolean>);
        setLoadingCourses(initialLoadingState);

        // Fetch course details for each unique course ID
        courseIds.forEach((courseId) => {
          fetchCourseDetails(courseId);
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unknown error";
        setError(`Không thể tải danh sách giao dịch: ${errorMessage}`);
        console.error("Error fetching orders:", err);
      } finally {
        setLoading(false);
      }
    }
    getOrders();
  }, [token, tenantId, currentPage, limit, authLoading]);

  // Fetch course details for a given course ID
  const fetchCourseDetails = async (courseId: string) => {
    if (!token || !tenantId) return;

    try {
      const course = await fetchCourseById({ courseId, tenantId, token });
      setCourseInfo((prev) => ({
        ...prev,
        [courseId]: {
          title: course.title || "Không xác định",
          price: course.price,
        },
      }));
    } catch (err) {
      console.error(`Error fetching course ${courseId}:`, err);
      setCourseInfo((prev) => ({
        ...prev,
        [courseId]: {
          title: "Không thể tải thông tin",
          price: 0,
        },
      }));
    } finally {
      setLoadingCourses((prev) => ({
        ...prev,
        [courseId]: false,
      }));
    }
  };

  // Handle status update
  const handleStatusUpdate = async () => {
    if (!selectedOrderId || !newStatus || !token || !tenantId) return;

    try {
      setUpdatingStatus(true);
      await updateOrderStatus({
        orderId: selectedOrderId,
        status: newStatus,
        tenantId,
        token,
      });

      // Update the local order data
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === selectedOrderId
            ? { ...order, status: [newStatus] }
            : order
        )
      );

      toast({
        title: "Cập nhật thành công",
        description: "Trạng thái giao dịch đã được cập nhật",
      });

      // Close dialog
      setStatusUpdateDialogOpen(false);
    } catch (err) {
      console.error("Error updating order status:", err);
      toast({
        variant: "destructive",
        title: "Lỗi",
        description: "Không thể cập nhật trạng thái giao dịch",
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open status update dialog
  const openStatusUpdateDialog = (orderId: string, currentStatus: string[]) => {
    setSelectedOrderId(orderId);
    setNewStatus(currentStatus[0] || "");
    setStatusUpdateDialogOpen(true);
  };

  // Get unique courses for filter
  const courses = Array.from(
    new Set(
      orders.map((order) => {
        return courseInfo[order.course]?.title || order.course;
      })
    )
  );

  // Calculate totals
  const totalTransactions = totalOrders;
  const totalCompleted = orders.filter(
    (order) => order.status && order.status[0] === "paid"
  ).length;
  const totalAmount = orders.reduce((sum, order) => {
    if (order.status && order.status[0] === "paid") {
      return sum + (order.price || 0);
    }
    return sum;
  }, 0);
  const totalPending = orders.filter(
    (order) => order.status && order.status[0] === "pending"
  ).length;

  // Filter transactions based on search and filters
  const filteredTransactions = orders.filter((order) => {
    const orderDate = new Date(order.created_at);
    const formattedDate = format(orderDate, "MMM d, yyyy");
    const courseName = courseInfo[order.course]?.title || order.course;
    const userName = getOrderUserName(order);
    const userContact = getOrderUserContact(order);

    // Filter by status
    const statusMatch =
      statusFilter === "all" ||
      (order.status &&
        order.status[0].toLowerCase() === statusFilter.toLowerCase());

    // Filter by course
    const courseMatch = courseFilter === "all" || courseName === courseFilter;

    // Filter by date (if a date is selected)
    const dateMatch =
      !dateFilter || formattedDate === format(dateFilter, "MMM d, yyyy");

    // Filter by search query
    const searchMatch =
      searchQuery === "" ||
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userContact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order._id.toLowerCase().includes(searchQuery.toLowerCase());

    return statusMatch && courseMatch && dateMatch && searchMatch;
  });

  // Calculate pagination values
  const totalPages = Math.ceil(totalOrders / limit);
  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, courseFilter, dateFilter, searchQuery]);

  if (loading && orders.length === 0) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p>Đang tải dữ liệu giao dịch...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center h-64'>
        <p className='text-red-500'>{error}</p>
        <Button
          variant='outline'
          className='mt-4'
          onClick={() => window.location.reload()}
        >
          Thử lại
        </Button>
      </div>
    );
  }

  if (!authLoading && (!token || !tenantId)) {
    return (
      <div className='flex flex-col items-center justify-center h-64'>
        <p className='text-red-500 text-lg font-semibold mb-2'>
          Thiếu thông tin xác thực hoặc chi nhánh.
        </p>
        <p className='text-muted-foreground mb-4'>
          Vui lòng đăng nhập lại hoặc chọn chi nhánh để tiếp tục.
        </p>
        <div className='flex gap-4'>
          <Link href='/login'>
            <Button variant='outline'>Đăng nhập lại</Button>
          </Link>
          <Link href='/tenant-selection'>
            <Button variant='default'>Chọn chi nhánh</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className='mb-6'>
        <Link
          href='/dashboard/manager'
          className='inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground'
        >
          <ArrowLeft className='mr-1 h-4 w-4' />
          Quay lại Dashboard
        </Link>
      </div>

      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-3xl font-bold'>Giao dịch & Thanh toán</h1>
          <p className='text-muted-foreground'>
            Quản lý tất cả các giao dịch tài chính tại trung tâm bơi lội
          </p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline'>
            <Download className='mr-2 h-4 w-4' />
            Xuất dữ liệu
          </Button>
          <Link href='/dashboard/manager/transactions/new'>
            <Button>Ghi nhận thanh toán</Button>
          </Link>
        </div>
      </div>

      <div className='mt-8 grid gap-6 md:grid-cols-4'>
        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>
              Tổng số giao dịch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalTransactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>Đã thanh toán</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>
              Tổng doanh thu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{formatPrice(totalAmount)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-2'>
            <CardTitle className='text-sm font-medium'>
              Đang chờ thanh toán
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className='text-2xl font-bold'>{totalPending}</div>
          </CardContent>
        </Card>
      </div>

      <Card className='mt-8'>
        <CardHeader>
          <CardTitle>Lịch sử giao dịch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex flex-col gap-4 md:flex-row md:items-center mb-6'>
            <div className='flex-1 relative'>
              <Search className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
              <Input
                placeholder='Tìm kiếm theo mã giao dịch, tên học viên hoặc ID học viên...'
                className='pl-8'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className='grid grid-cols-3 gap-4'>
              <Select
                value={statusFilter}
                onValueChange={setStatusFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Trạng thái' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Tất cả trạng thái</SelectItem>
                  <SelectItem value='paid'>Đã thanh toán</SelectItem>
                  <SelectItem value='pending'>Đang chờ</SelectItem>
                  <SelectItem value='expired'>Đã hết hạn</SelectItem>
                  <SelectItem value='cancelled'>Đã hủy</SelectItem>
                  <SelectItem value='refunded'>Đã hoàn tiền</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={courseFilter}
                onValueChange={setCourseFilter}
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Khóa học' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Tất cả khóa học</SelectItem>
                  {courses.map((course) => (
                    <SelectItem
                      key={course}
                      value={course}
                    >
                      {course}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    className='w-full justify-start text-left font-normal'
                  >
                    <CalendarIcon className='mr-2 h-4 w-4' />
                    {dateFilter ? format(dateFilter, "PPP") : "Chọn ngày"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-auto p-0'>
                  <Calendar
                    mode='single'
                    selected={dateFilter}
                    onSelect={setDateFilter}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className='rounded-md border overflow-hidden'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã giao dịch</TableHead>
                  <TableHead>Học viên</TableHead>
                  <TableHead>Khóa học</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Ngày</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className='text-right'>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && orders.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='text-center py-10'
                    >
                      <div className='flex justify-center'>
                        <div className='animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full'></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((order) => {
                    const orderDate = new Date(order.created_at);
                    const formattedDate = format(orderDate, "dd/MM/yyyy");
                    const userName = getOrderUserName(order);
                    const userContact = getOrderUserContact(order);
                    const isLoadingCourse =
                      loadingCourses[order.course] || false;
                    const courseName =
                      courseInfo[order.course]?.title || "Đang tải...";

                    return (
                      <TableRow key={order._id}>
                        <TableCell className='font-medium'>
                          {order._id.substring(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className='flex items-start flex-col'>
                            <div className='font-medium'>{userName}</div>
                            <div className='text-xs text-muted-foreground'>
                              {userContact}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isLoadingCourse ? (
                            <div className='flex items-center'>
                              <span className='animate-pulse bg-muted rounded h-4 w-24 block'></span>
                            </div>
                          ) : (
                            courseName
                          )}
                        </TableCell>
                        <TableCell>{formatPrice(order.price)}</TableCell>
                        <TableCell>{formattedDate}</TableCell>
                        <TableCell>
                          {order.type === "guest"
                            ? "Khách"
                            : order.type === "member"
                            ? "Thành viên"
                            : Array.isArray(order.type)
                            ? order.type[0]
                            : order.type}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant='outline'
                            className={getStatusClass(order.status)}
                          >
                            {getStatusName(order.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className='text-right'>
                          <div className='flex justify-end gap-2'>
                            <Button
                              variant='ghost'
                              size='sm'
                              onClick={() =>
                                openStatusUpdateDialog(order._id, order.status)
                              }
                            >
                              Cập nhật
                            </Button>
                            <Link
                              href={`/dashboard/manager/transactions/${order._id}`}
                            >
                              <Button
                                variant='ghost'
                                size='sm'
                              >
                                Xem chi tiết
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className='text-center py-8 text-muted-foreground'
                    >
                      Không tìm thấy giao dịch phù hợp với bộ lọc hiện tại.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && totalPages > 1 && (
            <div className='flex items-center justify-between mt-4'>
              <div className='text-sm text-muted-foreground'>
                Hiển thị {Math.min((currentPage - 1) * limit + 1, totalOrders)}{" "}
                - {Math.min(currentPage * limit, totalOrders)} trong tổng số{" "}
                {totalOrders} giao dịch
              </div>
              <div className='flex items-center space-x-2'>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={!canGoPrevious}
                >
                  <ChevronLeft className='h-4 w-4' />
                  <span className='sr-only'>Trang trước</span>
                </Button>
                <div className='text-sm'>
                  Trang {currentPage} / {totalPages}
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={!canGoNext}
                >
                  <ChevronRight className='h-4 w-4' />
                  <span className='sr-only'>Trang sau</span>
                </Button>
              </div>
              <Select
                value={String(limit)}
                onValueChange={(value) => {
                  setLimit(Number(value));
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className='w-[120px]'>
                  <SelectValue placeholder='Hiển thị' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='10'>10 mỗi trang</SelectItem>
                  <SelectItem value='25'>25 mỗi trang</SelectItem>
                  <SelectItem value='50'>50 mỗi trang</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Update Dialog */}
      <Dialog
        open={statusUpdateDialogOpen}
        onOpenChange={setStatusUpdateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật trạng thái giao dịch</DialogTitle>
            <DialogDescription>
              Chọn trạng thái mới cho giao dịch này.
            </DialogDescription>
          </DialogHeader>
          <div className='py-4'>
            <Select
              value={newStatus}
              onValueChange={setNewStatus}
              disabled={updatingStatus}
            >
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Chọn trạng thái' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='paid'>Đã thanh toán</SelectItem>
                <SelectItem value='pending'>Đang chờ</SelectItem>
                <SelectItem value='expired'>Đã hết hạn</SelectItem>
                <SelectItem value='cancelled'>Đã hủy</SelectItem>
                <SelectItem value='refunded'>Đã hoàn tiền</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setStatusUpdateDialogOpen(false)}
              disabled={updatingStatus}
            >
              Hủy
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={updatingStatus || !newStatus}
            >
              {updatingStatus ? "Đang xử lý..." : "Cập nhật"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
