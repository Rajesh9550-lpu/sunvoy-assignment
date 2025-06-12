import puppeteer, { Browser, Page, Cookie } from "puppeteer";
import dotenv from "dotenv";

dotenv.config();

const runLoginScript = async (): Promise<string | null> => {
  const browser: Browser = await puppeteer.launch({ headless: true });
  const page: Page = await browser.newPage();
  try {
    const userName = process.env.USER_NAME!;
    const password = process.env.PASSWORD!;

    // naviate to login page
    await page.goto("https://challenge.sunvoy.com/login", {
      waitUntil: "networkidle2",
    });

    // grab the csrf value from the form

    const nonce: string = await page.$eval(
      'input[name ="nonce"]',
      (el: HTMLInputElement) => el.value
    );

    await page.evaluate(
      async ({nonce,userName,password})=>{
        const formData =  new URLSearchParams();
        formData.append("nonce",nonce);
        formData.append("username",userName);
        formData.append("password",password);
        await fetch("/login",{
        method:"POST",
        credentials:"include",
        headers:{
          "Content-Type":"application/x-www-form-urlencoded"
        },
        body :  formData.toString()
      })
      },{nonce,userName,password}     
    );
    await new Promise((resolve)=> setTimeout(resolve,1500));
    const cookies:Cookie[]= await page.cookies();
    if(cookies.length === 0){
      return null;
    }
    const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    return cookieString
  } catch (err) {
    console.log("errormessage is ...",err);
    return null;
  }
  finally{
    await browser.close()
  }
};
export default runLoginScript;
