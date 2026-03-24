FROM nginx:alpine

RUN rm -f /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 8080 8443

CMD ["nginx", "-g", "daemon off;"]
