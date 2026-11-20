export type CurrentWeather={
  tempC:number;condition:string;conditionCode:number;isDay:boolean;
  providerUpdatedAt:string;fetchedAt:string;location:'Cebu City'
}
export declare function parseCurrentWeather(payload:unknown):Omit<CurrentWeather,'fetchedAt'>
export declare function createWeatherEndpoint(options?:{
  apiKey?:string;fetchImpl?:typeof fetch;now?:()=>number;timeoutMs?:number
}):(req:unknown,res:unknown)=>Promise<void>
