// dashboard/src/pages/Jobs.tsx
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  CircularProgress,
  Alert,
  IconButton,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import {
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';

interface Job {
  id: string;
  job_uuid: string;
  channel_id: number;
  channel_username: string;
  job_type: string;
  status: string;
  priority: number;
  messages_collected: number;
  messages_target: number;
  progress_percent: number;
  worker_id: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  error_message: string;
}

const Jobs: React.FC = () => {
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['jobs', page, rowsPerPage, statusFilter],
    queryFn: () => apiService.getJobs({
      limit: rowsPerPage,
      offset: page * rowsPerPage,
      status: statusFilter !== 'all' ? statusFilter : undefined,
    }),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => apiService.cancelJob(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCancelJob = (jobId: string) => {
    if (window.confirm('Are you sure you want to cancel this job?')) {
      cancelMutation.mutate(jobId);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'info';
      case 'pending':
      case 'assigned':
        return 'warning';
      case 'failed':
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getJobTypeLabel = (type: string) => {
    switch (type) {
      case 'initial':
        return 'Initial Parse';
      case 'update':
        return 'Update';
      case 'full_sync':
        return 'Full Sync';
      case 'manual':
        return 'Manual';
      default:
        return type;
    }
  };

  const getDuration = (startedAt: string, completedAt: string) => {
    if (!startedAt) return '-';
    
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : new Date().getTime();
    const diff = Math.floor((end - start) / 1000);

    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading jobs: {error.message}
      </Alert>
    );
  }

  const statusCounts = {
    pending: data?.items?.filter((j: Job) => j.status === 'pending').length || 0,
    running: data?.items?.filter((j: Job) => j.status === 'running').length || 0,
    completed: data?.items?.filter((j: Job) => j.status === 'completed').length || 0,
    failed: data?.items?.filter((j: Job) => j.status === 'failed').length || 0,
  };

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Jobs</Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>
          <IconButton onClick={() => refetch()}>
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Pending
              </Typography>
              <Typography variant="h4" color="warning.main">
                {statusCounts.pending}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Running
              </Typography>
              <Typography variant="h4" color="info.main">
                {statusCounts.running}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Completed
              </Typography>
              <Typography variant="h4" color="success.main">
                {statusCounts.completed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Failed
              </Typography>
              <Typography variant="h4" color="error.main">
                {statusCounts.failed}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Jobs Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Job ID</TableCell>
              <TableCell>Channel</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Worker</TableCell>
              <TableCell>Progress</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.items?.map((job: Job) => (
              <TableRow key={job.job_uuid} hover>
                <TableCell>
                  <Tooltip title={job.job_uuid}>
                    <Typography variant="body2" fontFamily="monospace">
                      {job.job_uuid.substring(0, 8)}...
                    </Typography>
                  </Tooltip>
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    @{job.channel_username}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Chip
                    label={getJobTypeLabel(job.job_type)}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>

                <TableCell>
                  <Chip
                    label={job.status}
                    color={getStatusColor(job.status)}
                    size="small"
                  />
                </TableCell>

                <TableCell>
                  <Typography variant="body2" fontFamily="monospace">
                    {job.worker_id || '-'}
                  </Typography>
                </TableCell>

                <TableCell>
                  {job.status === 'running' ? (
                    <Box>
                      <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                        <LinearProgress
                          variant="determinate"
                          value={job.progress_percent || 0}
                          sx={{ flexGrow: 1 }}
                        />
                        <Typography variant="caption">
                          {job.progress_percent || 0}%
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        {job.messages_collected?.toLocaleString() || 0}
                        {job.messages_target && ` / ${job.messages_target.toLocaleString()}`} messages
                      </Typography>
                    </Box>
                  ) : job.status === 'completed' ? (
                    <Typography variant="body2">
                      {job.messages_collected?.toLocaleString() || 0} messages
                    </Typography>
                  ) : (
                    '-'
                  )}
                </TableCell>

                <TableCell>
                  <Typography variant="body2">
                    {getDuration(job.started_at, job.completed_at)}
                  </Typography>
                </TableCell>

                <TableCell>
                  <Tooltip title={new Date(job.created_at).toLocaleString()}>
                    <Typography variant="body2">
                      {new Date(job.created_at).toLocaleDateString()}
                    </Typography>
                  </Tooltip>
                </TableCell>

                <TableCell align="right">
                  {(job.status === 'pending' || job.status === 'running') && (
                    <IconButton
                      size="small"
                      onClick={() => handleCancelJob(job.job_uuid)}
                      disabled={cancelMutation.isPending}
                    >
                      <CancelIcon />
                    </IconButton>
                  )}
                  {job.status === 'failed' && job.error_message && (
                    <Tooltip title={job.error_message}>
                      <IconButton size="small" color="error">
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={data?.total || 0}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  );
};

export default Jobs;