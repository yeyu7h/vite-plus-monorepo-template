# Admin Request Effect

An Axios-based request client for admin applications. It provides typed request helpers, configurable response unwrapping, request and response interceptors, refresh-token request queuing, and file upload/download helpers.

```ts
import { RequestClient, defaultResponseInterceptor } from '@monorepo/request'

const client = new RequestClient({ baseURL: '/api', responseReturn: 'data' })

client.addResponseInterceptor(
  defaultResponseInterceptor({
    codeField: 'code',
    dataField: 'data',
    successCode: 0,
  }),
)

const users = await client.get<User[]>('/users')
```
