import React, { useEffect, useState } from 'react';
import { Navbar, Nav, Container, NavDropdown } from 'react-bootstrap';
import { SearchBox } from './SearchBox';
import { useLogoutMutation } from 'src/generated/graphql';
import { useApolloClient } from '@apollo/client';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import NextLink from 'next/link';
import { CategoryList } from './CategoryList';
import { useUserAuth } from 'src/app/hooks/useUserAuth';

export const Header = () => {
  const apolloClient = useApolloClient();
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [logout, { loading: logoutFetching }] = useLogoutMutation();
  const [user] = useUserAuth();
  const router = useRouter();

  const logoutUser = async () => {
    if (!logoutFetching) {
      await logout();
      await apolloClient.resetStore();

      toast.success('Logged out successfully', {
        position: 'bottom-left',
        autoClose: 1000,
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });

      router.push('/');
    }
  };

  let authGroupButtons = (
    <>
      <NextLink href="/login" passHref>
        <Nav.Link>
          <i className="fas fa-sign-in-alt"></i> Login
        </Nav.Link>
      </NextLink>

      <NextLink href="/register" passHref>
        <Nav.Link>
          <i className="fas fa-user-plus"></i> Register
        </Nav.Link>
      </NextLink>
    </>
  );
  if (user) {
    authGroupButtons = (
      <>
        <NavDropdown title={user?.fullName || user?.username} id="username">
          <NextLink href="/profile" passHref>
            <NavDropdown.Item>Profile</NavDropdown.Item>
          </NextLink>
          <NavDropdown.Item onClick={() => logoutUser()}>Logout</NavDropdown.Item>
        </NavDropdown>
      </>
    );
  }

  const groupAdmin = (
    <NavDropdown title="Dashboard" id="adminmenu">
      <NextLink href="/admin/product/new" passHref>
        <NavDropdown.Item>Create Product</NavDropdown.Item>
      </NextLink>
      <NextLink href="/admin/users" passHref>
        <NavDropdown.Item>Users</NavDropdown.Item>
      </NextLink>
      <NextLink href="/admin/product-list" passHref>
        <NavDropdown.Item>Product List</NavDropdown.Item>
      </NextLink>
      <NextLink href="/admin/orders" passHref>
        <NavDropdown.Item>Orders</NavDropdown.Item>
      </NextLink>
    </NavDropdown>
  );

  const [width, setWidth] = useState(1000);

  useEffect(() => {
    setLoadingHeader(false);
    function handleResize() {
      setWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [user, loadingHeader, setLoadingHeader, width, setWidth]);

  return (
    <header className="bg-dark px-2">
      <Navbar bg="dark" variant="dark" expand="lg" collapseOnSelect className="py-3">
        <Container fluid style={{ maxWidth: '1400px' }}>
          <NextLink href="/" passHref>
            <Navbar.Brand>ZetaShop</Navbar.Brand>
          </NextLink>
          <SearchBox />
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ml-auto">
              <NextLink href="/cart" passHref>
                <Nav.Link>
                  <i className="fas fa-shopping-cart"></i> Cart
                </Nav.Link>
              </NextLink>
              {user && user?.role == 'ADMIN' && groupAdmin}
              {authGroupButtons}
            </Nav>
          </Navbar.Collapse>
        </Container>
        {width < 992 && <CategoryList width={width} />}
      </Navbar>
      <Container fluid style={{ maxWidth: '1400px' }}>
        {width >= 992 && <CategoryList width={width} />}
      </Container>
    </header>
  );
};
