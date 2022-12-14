import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

export const Footer = () => {
  return (
    <footer>
      <Container fluid className="bg-gray">
        <Row>
          <Col className="text-center py-3">Copyright 2021 &copy; ZetaShop</Col>
        </Row>
      </Container>
    </footer>
  );
};
