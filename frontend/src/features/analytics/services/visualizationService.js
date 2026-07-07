/**
 * Service for fetching all rows of a data source from the backend
 * @param {string} dsId - The data source ID
 * @param {Function} apiRequest - The authenticated apiRequest function from AuthContext
 * @returns {Promise<object[]>} - The complete set of rows
 */
export const fetchDataSourceAllRows = async (dsId, apiRequest) => {
  const res = await apiRequest(`/datasources/${dsId}/all-rows`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Dataset not found. It may have been deleted or access is denied.');
    }
    let errMsg = 'Failed to fetch the complete dataset rows from database.';
    try {
      const errorData = await res.json();
      if (errorData?.error?.message) {
        errMsg = errorData.error.message;
      }
    } catch (e) {
      // ignore JSON parse error
    }
    throw new Error(errMsg);
  }
  return await res.json();
};
