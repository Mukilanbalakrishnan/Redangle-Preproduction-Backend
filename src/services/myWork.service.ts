import { getMyWorkQuery } from "../queries/myWork.query"

export const getMyWorkService = async (employeeId: number) => {
  return await getMyWorkQuery(employeeId)
}