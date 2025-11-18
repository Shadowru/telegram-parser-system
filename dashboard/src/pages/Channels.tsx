// dashboard/src/pages/Channels.tsx
import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';

interface Channel {
  id: number;
  username: string;
  title: string;
  members_count: number;
  status: string;
  last_parsed_at: string;
  created_at: string;
}

const Channels: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [newChannel, setNewChannel] = useState({ username: '', parse_frequency: 300 });

  // Fetch channels
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['channels', page, rowsPerPage, search],
    queryFn: () => apiService.getChannels({
      limit: rowsPerPage,
      offset: page * rowsPerPage,
      search: search || undefined,
    }),
  });

  // Create channel mutation
  const createMutation = useMutation({
    mutationFn: (data: any) => apiService.createChannel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setOpenDialog(false);
      setNewChannel({ username: '', parse_frequency: 300 });
    },
  });

  // Delete channel mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiService.deleteChannel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  // Trigger parse mutation
  const parseMutation = useMutation({
    mutationFn: (id: number) => apiService.triggerParse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
    },
  });

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleCreateChannel = () => {
    createMutation.mutate(newChannel);
  };

  const handleDeleteChannel = (id: number) => {
    if (window.confirm('Are you sure you want to delete this channel?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleTriggerParse = (id: number) => {
    parseMutation.mutate(id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'paused':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
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
        Error loading channels: {error.message}
      </Alert>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Channels</Typography>
        <Box display="flex" gap={2}>
          <TextField
            size="small"
            placeholder="Search channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Add Channel
          </Button>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Channels
              </Typography>
              <Typography variant="h4">
                {data?.total || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active
              </Typography>
              <Typography variant="h4" color="success.main">
                {data?.items?.filter((c: Channel) => c.status === 'active').length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Paused
              </Typography>
              <Typography variant="h4" color="warning.main">
                {data?.items?.filter((c: Channel) => c.status === 'paused').length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Errors
              </Typography>
              <Typography variant="h4" color="error.main">
                {data?.items?.filter((c: Channel) => c.status === 'error').length || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Channels Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Username</TableCell>
              <TableCell>Title</TableCell>
              <TableCell align="right">Members</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last Parsed</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data?.items?.map((channel: Channel) => (
              <TableRow
                key={channel.id}
                hover
                onClick={() => navigate(`/channels/${channel.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <TableCell>@{channel.username}</TableCell>
                <TableCell>{channel.title || '-'}</TableCell>
                <TableCell align="right">
                  {channel.members_count?.toLocaleString() || '-'}
                </TableCell>
                <TableCell>
                  <Chip
                    label={channel.status}
                    color={getStatusColor(channel.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {channel.last_parsed_at
                    ? new Date(channel.last_parsed_at).toLocaleString()
                    : 'Never'}
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    onClick={() => handleTriggerParse(channel.id)}
                    disabled={parseMutation.isPending}
                  >
                    <PlayIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => navigate(`/channels/${channel.id}/edit`)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteChannel(channel.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <DeleteIcon />
                  </IconButton>
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

      {/* Add Channel Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Channel</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Channel Username"
            placeholder="@channelname"
            fullWidth
            value={newChannel.username}
            onChange={(e) => setNewChannel({ ...newChannel, username: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Parse Frequency (seconds)"
            type="number"
            fullWidth
            value={newChannel.parse_frequency}
            onChange={(e) => setNewChannel({ ...newChannel, parse_frequency: parseInt(e.target.value) })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreateChannel}
            variant="contained"
            disabled={!newChannel.username || createMutation.isPending}
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Channels;