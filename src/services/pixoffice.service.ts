import { insertPixofficeEntryQuery, getPixofficeStatsQuery } from "../queries/pixoffice.query";

export const submitPixofficeDataService = async (data: any) => {
    return await insertPixofficeEntryQuery(data);
};

export const getPixofficeStatsService = async () => {
    return await getPixofficeStatsQuery();
};
