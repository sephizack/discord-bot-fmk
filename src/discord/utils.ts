
import Logger from "./logger";

namespace Utils {

    export type ApiCallResult = {
        status: number,
        isJson: boolean,
        data?: any,
        error?: string
    }

    export function computeDateDiffInDays(requestedDateStr :string)
    {
        let d = new Date();
        let localDateStr = d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
        let localDateObj = new Date(localDateStr + " UTC");
        let requestedDate = new Date(requestedDateStr + " UTC");

        let daysDiff = Math.floor((requestedDate.getTime() - localDateObj.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff
    }
    
    const kDaysList = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    export function getDayStringFromNumber(dayId : number)
    {
        return kDaysList[dayId]
    }

    export const TASK_EXEC_RESULT = {
        RETRY: 0,
        DONE: 1,
        ABORT: 2,
        NO_SLOT_AVAIL: 3
    }

    export function getNewTokenForMap(map, size)
    {
        var ret = genRandStr(size);
        while (map[ret]) ret = genRandStr(size);
        return ret
    }

    export function genRandStr(length)
    {
        var requestedLength = length ? length : 20;
        var result           = '';
        var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        var charactersLength = characters.length;
        for (var i=0; i<requestedLength; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    export function getDayStringFromDate(d: Date) {
        let day = d.getDay();
        return kDaysList[day];
    }

    export async function sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

    export async function GET(url = '', auth_header = "") : Promise<ApiCallResult> {
        return callApi(url, null, 'GET', auth_header)
    }

    export async function PUT(url = '', body = {}, auth_header = "") : Promise<ApiCallResult> {
		return callApi(url, null, 'PUT', auth_header)
	}
    
    export async function POST(url = '', body = {}, auth_header = "") : Promise<ApiCallResult> {
        return callApi(url, body, 'POST', auth_header)
    }

    export async function callApi(url = '', body = {}, method = 'POST', auth_header = "") : Promise<ApiCallResult>
    {
        await sleep(277);
        let response = null;
        try {
            response = await fetch(url, {
                "headers": {
                    "accept": "*/*",
                    "accept-language": "en-US,en;q=0.9",
                    "content-type": "application/json; charset=UTF-8",
                    "sec-ch-ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\"",
                    "sec-ch-ua-mobile": "?0",
                    "sec-ch-ua-platform": "\"macOS\"",
                    "sec-fetch-dest": "empty",
                    "sec-fetch-mode": "cors",
                    "sec-fetch-site": "same-origin",
                    "x-requested-with": "XMLHttpRequest",
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Authorization": auth_header == "" ? null : auth_header
                },
                "body": body == null ? null : JSON.stringify(body),
                "method": method
            });
        }
        catch (e)
        {
            Logger.error(this.name, "Error while calling API "+url, e);
            return {
                status: 500,
                error: JSON.stringify(e),
                isJson: false
            }
        }
        

        let rawData:any = await response.text();
        if (response.status < 200 || response.status >= 300)
        {
            return {
                status: response.status,
                error: response.statusText + " - " + rawData,
                isJson: false
            }
        }
        let isJson = false
        try {
            rawData = JSON.parse(rawData);
            isJson = true;
        }
        catch (e) {
            // Not json
        }
        if (isJson && rawData.status == 400)
        {
            rawData.error = JSON.stringify(rawData.message)
        }

        let result = {
            status: response.status,
            isJson: isJson,
            data: rawData
        }

        return result
    }
    
}

export default Utils