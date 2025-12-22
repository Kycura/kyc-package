import { ISelectedParams, IStoreData } from '../../contexts/app-state';
import { IDocumentVerificationResponse } from './types';
import {
  getAuthorizationHeader,
  getUpdateContextEndpoint,
  getUploadFileEndpoint,
  getVerificationStatusEndpoint,
} from '../../contexts/configuration/getters';
import { AnyRecord } from '../../../types';

// Remove these eager evaluations - endpoints will be resolved when needed

export const generateParams = (data: IDocumentVerificationResponse): ISelectedParams => {
  const params: ISelectedParams = { sync: true };

  Object.keys(data).forEach(key => {
    params[key] = data[key as keyof IDocumentVerificationResponse] as string;
  });

  return params;
};

const staticHeaders = {
  mode: 'no-cors',
};

const httpPost = async <TResponse>(url: string, body: FormData) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthorizationHeader(),
      ...staticHeaders,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching ${url}. http code: ${response.status}, ${response.statusText}.`,
    );
  }

  return (await response.json()) as Promise<TResponse>;
};

const httpPatch = async <TResponse>(url: string, body: AnyRecord) => {
  const init = {
    method: 'PATCH',
    headers: {
      Authorization: getAuthorizationHeader(),
      'Content-Type': 'application/json',
      ...staticHeaders,
    },
    body: JSON.stringify(body),
  };

  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(
      `Error patching ${url}. http code: ${response.status}, ${response.statusText}.`,
    );
  }

  return (await response.json()) as Promise<TResponse>;
};

const httpGet = async (url: string) => {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: getAuthorizationHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(
      `Error fetching ${url}. http code: ${response.status}, ${response.statusText}.`,
    );
  }

  return response.json();
};

export const getVerificationStatus = async (_endUserId: string) => {
  const verificationId = localStorage.getItem('verificationId') as string;
  const endpointUrl = getVerificationStatusEndpoint({ verificationId });

  // TODO: Enter a validation step here that would infer the response's type
  return httpGet(endpointUrl) as Promise<IDocumentVerificationResponse>;
};

const base64ToBlob = (dataURI: string) => {
  const splitDataURI = dataURI.split(',');
  const byteString =
    splitDataURI[0].indexOf('base64') >= 0 ? atob(splitDataURI[1]) : decodeURI(splitDataURI[1]);
  const mimeString = splitDataURI[0].split(':')[1].split(';')[0];

  const ia = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ia], { type: mimeString });
};

const createDocument = (
  {
    metadata,
    type,
    kind,
  }: {
    metadata: Record<string, string>;
    type: string;
    kind?: string;
  },
  pages: { kycuraFileId: string; metadata: { side: string } }[],
) => ({
  metadata,
  type,
  category: kind,
  properties: {},
  issuingVersion: 1,
  version: 1,
  issuer: {
    country: 'ZZ',
  },
  pages,
});

const updateContext = async (context: Record<string, unknown>) => {
  return await httpPatch(getUpdateContextEndpoint(), { context });
};

export const verifyDocuments = async (data: IStoreData): Promise<string> => {
  if (data.selfie) {
    data.docs[0].pages.push({
      side: 'selfie',
      base64: data.selfie,
    });
  }

  // Upload files sequentially instead of in parallel to avoid race conditions
  const results: { kycuraFileId: string; metadata: { side: string } }[] = [];
  for (const doc of data.docs) {
    for (const page of doc.pages) {
      const formData = new FormData();
      formData.append('file', base64ToBlob(page.base64 as string), `${doc.type}-${page.side}.jpeg`);

      const { id } = await httpPost<{ id: string }>(getUploadFileEndpoint(), formData);

      results.push({ kycuraFileId: id, metadata: { side: page.side } });
    }
  }

  const documents = data.docs.map(doc => createDocument(doc, results));

  await updateContext({ documents });

  localStorage.setItem('verificationId', results[0].kycuraFileId);

  return results[0].kycuraFileId;
};
