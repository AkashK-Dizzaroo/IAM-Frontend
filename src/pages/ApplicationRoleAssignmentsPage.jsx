import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import userService from '../services/user.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Globe, Shield, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

const ApplicationRoleAssignmentsPage = () => {
  const { user } = useAuth()

  // Fetch user assignments
  const { data: assignmentsData, isLoading, error } = useQuery({
    queryKey: ['userAssignments'],
    queryFn: async () => {
      const response = await userService.getUserRolesAndResources()
      return response.data
    },
    enabled: !!user
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading assignments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-red-600 mb-4">Failed to load assignments</p>
              <p className="text-sm text-gray-500">{error.message || 'An error occurred while fetching your assignments'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const assignments = assignmentsData || []

  // Format date helper
  const formatDate = (date) => {
    if (!date) return '—'
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch (e) {
      return '—'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Application & Role Assignments</h2>
        <p className="text-gray-600 mt-1">View all your application access, roles, and resource assignments</p>
      </div>

      {/* Table */}
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">You don't have any assignments yet.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Assignments
                </CardTitle>
                <CardDescription>
                  Your application access, roles, and resource assignments
                </CardDescription>
              </div>
              <Badge variant="outline" className="flex items-center gap-1">
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                {assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Application</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Resource</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Approved by</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Start date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">End date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.map((assignment) => {
                    // Check if assignment is expired
                    const isExpired = assignment.validUntil && new Date(assignment.validUntil) < new Date()
                    const isActive = assignment.isActive && !isExpired

                    return (
                      <tr key={assignment.id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Application */}
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {assignment.application?.name || 'Unknown Application'}
                              </div>
                              {assignment.application?.appCode && (
                                <div className="text-xs text-gray-500 truncate">
                                  {assignment.application.appCode}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Resource */}
                        <td className="px-4 py-4">
                          {assignment.resource && assignment.resource.name ? (
                            <div className="min-w-0">
                              <div className="font-medium text-gray-900 truncate">
                                {assignment.resource.name}
                              </div>
                              {assignment.resource.type && (
                                <div className="text-xs text-gray-500 truncate">
                                  {assignment.resource.type}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Global Access</span>
                          )}
                        </td>

                        {/* Role */}
                        <td className="px-4 py-4">
                          {assignment.role ? (
                            <Badge variant="outline" className="text-xs">
                              {assignment.role.roleCode || assignment.role.name}
                            </Badge>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>

                        {/* Approved by */}
                        <td className="px-4 py-4">
                          {assignment.assignedBy ? (
                            <div className="min-w-0">
                              <div className="text-gray-900 truncate">
                                {assignment.assignedBy.name || assignment.assignedBy.email || '—'}
                              </div>
                              {assignment.assignedBy.name && assignment.assignedBy.email && (
                                <div className="text-xs text-gray-500 truncate">
                                  {assignment.assignedBy.email}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">—</span>
                          )}
                        </td>

                        {/* Start date */}
                        <td className="px-4 py-4 text-gray-700">
                          {formatDate(assignment.validFrom)}
                        </td>

                        {/* End date */}
                        <td className="px-4 py-4">
                          {assignment.validUntil ? (
                            <div>
                              <div className={`${isExpired ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                                {formatDate(assignment.validUntil)}
                              </div>
                              {isExpired && (
                                <div className="text-xs text-red-500 mt-1">Expired</div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">No expiration</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <Badge 
                            variant={isActive ? 'default' : 'secondary'}
                            className="flex items-center gap-1 w-fit"
                          >
                            {isActive ? (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Active
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                {isExpired ? 'Expired' : 'Inactive'}
                              </>
                            )}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default ApplicationRoleAssignmentsPage

